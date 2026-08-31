export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-errors";
import { countAnnotatedTasks, isTaskAnnotated } from "@/helpers/annotation_progress";
import { isValidBatchData, normalizeTtsAnnotationTasks } from "@/helpers/validate_uploading_batch";
import { shuffleAndAnonymizeModels } from "@/helpers/task_models_shuffler";
import { emitWebhookEvent } from "@/lib/api-webhooks";
import type { BatchDetailTypes, EvalTaskTypes } from "@/types/data";

type RouteParams = { params: Promise<{ batchId: string }> };

/** GET /api/v1/batches/{batchId}/tasks — Paginated task list. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req, "tasks:read");
  if (caller instanceof Response) return caller;

  const { batchId } = await params;
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "20", 10) || 20, 1), 100);
  const cursorParam = sp.get("cursor");
  const cursorIndex = cursorParam ? parseInt(cursorParam, 10) : 0;
  const statusFilter = sp.get("status"); // pending | completed | reviewed

  const client = await getClientPromise();
  const db = client.db();

  const detail = await db
    .collection<BatchDetailTypes>("batches_details")
    .findOne({ batch_id: batchId });

  if (!detail) {
    return apiError(ErrorCodes.NOT_FOUND, `Batch '${batchId}' not found.`, 404);
  }

  // Authorization
  if (caller.role !== "root") {
    const email = caller.username.toLowerCase();
    const isOwner =
      detail.created_by?.toLowerCase() === email ||
      detail.annotator_id?.toLowerCase() === email ||
      detail.qa_id?.toLowerCase() === email;
    if (!isOwner) {
      return apiError(ErrorCodes.FORBIDDEN, "You do not have access to this batch.", 403);
    }
  }

  const datasetType = detail.dataset_type ?? "mt";
  const batch = await db
    .collection(`${datasetType}_batches`)
    .findOne({ batch_id: batchId });

  if (!batch || !Array.isArray(batch.tasks)) {
    return apiError(ErrorCodes.NOT_FOUND, `Batch task data for '${batchId}' not found.`, 404);
  }

  let tasks: EvalTaskTypes[] = batch.tasks;

  // Filter by status
  if (statusFilter === "pending") {
    tasks = tasks.filter((t) => !isTaskAnnotated(t, detail.workflow));
  } else if (statusFilter === "completed") {
    tasks = tasks.filter((t) => isTaskAnnotated(t, detail.workflow));
  } else if (statusFilter === "reviewed") {
    tasks = tasks.filter((t) => !!t.reviewer_comment);
  }

  const totalCount = tasks.length;
  const page = tasks.slice(cursorIndex, cursorIndex + limit);
  const nextIndex = cursorIndex + limit;
  const hasMore = nextIndex < totalCount;

  return apiSuccess({
    data: page,
    pagination: {
      next_cursor: hasMore ? String(nextIndex) : null,
      has_more: hasMore,
      total_count: totalCount,
    },
  });
}


/**
 * POST /api/v1/batches/{batchId}/tasks — Append tasks to an existing batch.
 *
 * This is the streaming counterpart to `POST /api/v1/batches`: offline prep
 * pipelines can push new work into a batch that annotators are already using,
 * instead of building a whole batch up front. Per-task rules are delegated to
 * the same validator the UI upload path uses, so the two can never drift.
 *
 * Note: an annotator with the batch open loads its tasks once on selection, so
 * appended tasks surface on their next load of the batch, not mid-session.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req, "tasks:write");
  if (caller instanceof Response) return caller;

  const { batchId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError(ErrorCodes.VALIDATION_FAILED, "Invalid JSON body.", 400);
  }

  const client = await getClientPromise();
  const db = client.db();

  const detail = await db
    .collection<BatchDetailTypes>("batches_details")
    .findOne({ batch_id: batchId });

  if (!detail) {
    return apiError(ErrorCodes.NOT_FOUND, `Batch '${batchId}' not found.`, 404);
  }

  // Appending changes the amount of work in a batch, so it stays with whoever
  // owns the batch — an assigned annotator must not be able to extend their
  // own workload.
  const email = caller.username.toLowerCase();
  const isRoot = caller.role.toLowerCase() === "root";
  if (!isRoot && detail.created_by?.toLowerCase() !== email) {
    return apiError(
      ErrorCodes.FORBIDDEN,
      "Only the batch creator or a root user can append tasks.",
      403
    );
  }

  // Replaying a lost response must not append the tasks twice.
  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey) {
    const existing = await db
      .collection("api_idempotency_keys")
      .findOne({ key: idempotencyKey });
    if (existing) {
      return apiSuccess(existing.response, 200);
    }
  }

  const incoming = body.tasks;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return apiError(
      ErrorCodes.VALIDATION_FAILED,
      "'tasks' is required and must be a non-empty array.",
      400
    );
  }

  const datasetType = (detail.dataset_type ?? "mt") as "mt" | "asr" | "tts";
  const isTtsAnnotation = datasetType === "tts" && detail.workflow === "annotation";

  // Validate the incoming tasks with the same rules the UI upload path uses.
  // `requireMetadata: false` requires only `tasks`, so batch-level metadata is
  // taken from the stored batch rather than re-sent by the caller. The TTS
  // workflow branch still runs, which is what selects annotation vs evaluation
  // task rules.
  const envelope = {
    tasks: incoming,
    ...(datasetType === "tts" ? { workflow: detail.workflow } : {}),
  } as unknown as Parameters<typeof isValidBatchData>[1];

  const validation = isValidBatchData(datasetType, envelope, {
    requireMetadata: false,
  });
  if (!validation.isValid) {
    return apiError(ErrorCodes.VALIDATION_FAILED, validation.message, 400);
  }

  const batchDoc = await db
    .collection(`${datasetType}_batches`)
    .findOne({ batch_id: batchId });

  if (!batchDoc || !Array.isArray(batchDoc.tasks)) {
    return apiError(
      ErrorCodes.NOT_FOUND,
      `Batch task data for '${batchId}' not found.`,
      404
    );
  }

  // Task ids are `string | number` throughout, so collisions are compared as
  // strings. Appends are all-or-nothing: a single conflict rejects the payload
  // rather than silently applying half of it.
  const existingIds = new Set(
    (batchDoc.tasks as EvalTaskTypes[]).map((t) => String(t.id))
  );
  const incomingTasks = incoming as EvalTaskTypes[];
  const seenIds = new Set<string>();
  const duplicateIds: string[] = [];

  for (const task of incomingTasks) {
    const id = String(task.id);
    if (existingIds.has(id) || seenIds.has(id)) {
      if (!duplicateIds.includes(id)) duplicateIds.push(id);
    }
    seenIds.add(id);
  }

  if (duplicateIds.length > 0) {
    return apiError(
      ErrorCodes.CONFLICT,
      `Task id(s) already present in batch '${batchId}' or repeated in the payload: ${duplicateIds.join(", ")}.`,
      409
    );
  }

  // Deep clone: shuffleAndAnonymizeModels rewrites model labels in place.
  const preparedTasks = isTtsAnnotation
    ? normalizeTtsAnnotationTasks(
        JSON.parse(JSON.stringify(incomingTasks)) as EvalTaskTypes[]
      )
    : (JSON.parse(JSON.stringify(incomingTasks)) as EvalTaskTypes[]);

  // Shuffling is keyed per task (hash of task id + seed), so appended tasks get
  // their own independent mapping and never disturb the existing ones.
  const { anonymized_tasks, task_models_shuffles: appendedShuffles } =
    isTtsAnnotation
      ? { anonymized_tasks: preparedTasks, task_models_shuffles: {} }
      : shuffleAndAnonymizeModels(preparedTasks);

  const update: Record<string, unknown> = {
    $push: { tasks: { $each: anonymized_tasks } },
  };

  if (!isTtsAnnotation) {
    const mergedShuffles = {
      ...((batchDoc.task_models_shuffles ?? {}) as Record<
        string,
        Record<string, string>
      >),
      ...appendedShuffles,
    };
    update.$set = { task_models_shuffles: mergedShuffles };
  }

  // All tasks live in a single document, so the append itself is atomic.
  const result = await db
    .collection(`${datasetType}_batches`)
    .updateOne({ batch_id: batchId }, update);

  if (result.matchedCount === 0) {
    return apiError(
      ErrorCodes.NOT_FOUND,
      `Batch task data for '${batchId}' not found.`,
      404
    );
  }

  // Recount from the stored array rather than incrementing, so a detail doc
  // that ever drifted repairs itself on the next append.
  const updatedBatch = await db
    .collection(`${datasetType}_batches`)
    .findOne({ batch_id: batchId });
  const storedTasks = (updatedBatch?.tasks ?? []) as EvalTaskTypes[];

  const detailUpdate: Record<string, unknown> = {
    number_of_tasks: storedTasks.length,
    annotated_tasks: countAnnotatedTasks(storedTasks, detail.workflow),
  };

  // An evaluation batch's `models` list is derived from the shuffle mapping;
  // appended tasks may introduce a model the batch did not have before.
  if (!isTtsAnnotation) {
    const allShuffles = {
      ...((batchDoc.task_models_shuffles ?? {}) as Record<
        string,
        Record<string, string>
      >),
      ...appendedShuffles,
    };
    const modelNames = Array.from(
      new Set(Object.values(allShuffles).flatMap((m) => Object.values(m)))
    );
    if (modelNames.length > 0) detailUpdate.models = modelNames;
  }

  await db
    .collection("batches_details")
    .updateOne({ batch_id: batchId }, { $set: detailUpdate });

  const responseData = {
    batch_id: batchId,
    dataset_type: datasetType,
    appended: anonymized_tasks.length,
    number_of_tasks: storedTasks.length,
    task_ids: anonymized_tasks.map((t) => t.id),
  };

  if (idempotencyKey) {
    await db.collection("api_idempotency_keys").insertOne({
      key: idempotencyKey,
      response: responseData,
      created_at: new Date(),
    });
    db.collection("api_idempotency_keys")
      .createIndex({ created_at: 1 }, { expireAfterSeconds: 86400, background: true })
      .catch(() => {});
  }

  emitWebhookEvent("tasks.appended", responseData);

  return apiSuccess(responseData, 201);
}
