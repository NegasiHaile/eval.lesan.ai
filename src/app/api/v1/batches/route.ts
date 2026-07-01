export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-errors";
import { isValidBatchData } from "@/helpers/validate_uploading_batch";
import { shuffleAndAnonymizeModels } from "@/helpers/task_models_shuffler";
import { emitWebhookEvent } from "@/lib/api-webhooks";
import type { BatchDetailTypes, BatchTasksTypes } from "@/types/data";

const VALID_TYPES = ["mt", "asr", "tts"];

function computeStatus(detail: BatchDetailTypes): string {
  const hasAnnotator = !!detail.annotator_id;
  const hasReviewer = !!detail.qa_id;
  const total = detail.number_of_tasks;
  const annotated =
    typeof detail.annotated_tasks === "string"
      ? parseInt(detail.annotated_tasks, 10)
      : detail.annotated_tasks;

  if (!hasAnnotator) return "pending";
  if (annotated === 0) return "assigned";
  if (annotated < total) return "in_progress";
  // All annotated
  if (!hasReviewer) return "annotated";
  return "completed";
}

/**
 * Mongo query fragment mirroring `computeStatus`, so status filtering happens
 * in the database and stays consistent with pagination / total_count.
 * Returns null for an unrecognized status.
 */
function statusConditions(status: string): Record<string, unknown> | null {
  const annotated = { $toInt: { $ifNull: ["$annotated_tasks", 0] } };
  const total = { $toInt: { $ifNull: ["$number_of_tasks", 0] } };
  switch (status) {
    case "pending":
      return { annotator_id: null };
    case "assigned":
      return { annotator_id: { $ne: null }, $expr: { $eq: [annotated, 0] } };
    case "in_progress":
      return {
        annotator_id: { $ne: null },
        $expr: { $and: [{ $gt: [annotated, 0] }, { $lt: [annotated, total] }] },
      };
    case "annotated":
      return {
        annotator_id: { $ne: null },
        qa_id: null,
        $expr: { $and: [{ $gt: [annotated, 0] }, { $gte: [annotated, total] }] },
      };
    case "completed":
      return {
        annotator_id: { $ne: null },
        qa_id: { $ne: null },
        $expr: { $and: [{ $gt: [annotated, 0] }, { $gte: [annotated, total] }] },
      };
    default:
      return null;
  }
}

/** GET /api/v1/batches — List batches with pagination + filters. */
export async function GET(req: NextRequest) {
  const caller = await resolveApiCaller(req, "batches:read");
  if (caller instanceof Response) return caller;

  const sp = req.nextUrl.searchParams;
  const datasetType = sp.get("dataset_type")?.toLowerCase();

  if (!datasetType || !VALID_TYPES.includes(datasetType)) {
    return apiError(
      ErrorCodes.VALIDATION_FAILED,
      "Query param 'dataset_type' is required and must be one of: mt, asr, tts.",
      400
    );
  }

  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "20", 10) || 20, 1), 100);
  const cursor = sp.get("cursor");
  const statusFilter = sp.get("status");
  const annotatorFilter = sp.get("annotator_id");
  const qaFilter = sp.get("qa_id");

  const client = await getClientPromise();
  const db = client.db();

  const query: Record<string, unknown> = { dataset_type: datasetType };

  // Role-based filtering: non-root sees only their batches
  if (caller.role !== "root") {
    const escaped = caller.username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^${escaped}$`, "i");
    query.$or = [
      { created_by: { $regex: pattern } },
      { annotator_id: { $regex: pattern } },
      { qa_id: { $regex: pattern } },
    ];
  }

  if (annotatorFilter) query.annotator_id = annotatorFilter;
  if (qaFilter) query.qa_id = qaFilter;

  // Status filter is pushed into the query (via $and, to avoid key collisions
  // with the role/annotator/qa conditions above) so pagination + total_count
  // stay accurate. An unknown status matches nothing.
  if (statusFilter) {
    const sc = statusConditions(statusFilter);
    query.$and = [...((query.$and as object[]) ?? []), sc ?? { _id: null }];
  }

  // Use created_at as cursor field
  if (cursor) {
    query.created_at = { $lt: cursor };
  }

  const totalCount = await db
    .collection<BatchDetailTypes>("batches_details")
    .countDocuments(query as Record<string, unknown>);

  const docs = await db
    .collection<BatchDetailTypes>("batches_details")
    .find(query as Record<string, unknown>)
    .sort({ created_at: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = docs.length > limit;
  const page = docs.slice(0, limit);

  const data = page
    .map((d) => ({
      batch_id: d.batch_id,
      batch_name: d.batch_name,
      dataset_type: d.dataset_type,
      dataset_domain: d.dataset_domain,
      source_language: d.source_language,
      target_language: d.target_language,
      models: d.models,
      annotator_id: d.annotator_id,
      qa_id: d.qa_id,
      created_by: d.created_by,
      created_at: d.created_at,
      number_of_tasks: d.number_of_tasks,
      annotated_tasks: d.annotated_tasks,
      status: computeStatus(d),
    }));

  const nextCursor = hasMore ? page[page.length - 1]?.created_at ?? null : null;

  return apiSuccess({
    data,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
      total_count: totalCount,
    },
  });
}

/** POST /api/v1/batches — Create a new batch with tasks. */
export async function POST(req: NextRequest) {
  const caller = await resolveApiCaller(req, "batches:write");
  if (caller instanceof Response) return caller;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError(ErrorCodes.VALIDATION_FAILED, "Invalid JSON body.", 400);
  }

  const datasetType = (body.dataset_type as string)?.toLowerCase();
  if (!datasetType || !VALID_TYPES.includes(datasetType)) {
    return apiError(
      ErrorCodes.VALIDATION_FAILED,
      "'dataset_type' is required and must be one of: mt, asr, tts.",
      400
    );
  }

  const client = await getClientPromise();
  const db = client.db();

  // Idempotency check
  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey) {
    const existing = await db
      .collection("api_idempotency_keys")
      .findOne({ key: idempotencyKey });
    if (existing) {
      return apiSuccess(existing.response, 200);
    }
  }

  // Build batch data for validation
  const batchData = {
    batch_name: body.batch_name,
    dataset_domain: body.dataset_domain,
    tasks: body.tasks,
    ...(datasetType === "mt"
      ? { source_language: body.source_language, target_language: body.target_language }
      : { language: body.language }),
    rating_guideline: body.rating_guideline,
    domains: body.domains,
  } as BatchTasksTypes;

  const validation = isValidBatchData(
    datasetType as "mt" | "asr" | "tts",
    batchData,
    { requireMetadata: true }
  );

  if (!validation.isValid) {
    return apiError(ErrorCodes.VALIDATION_FAILED, validation.message, 400);
  }

  // Check duplicate batch_name
  const existingBatch = await db
    .collection<BatchDetailTypes>("batches_details")
    .findOne({ batch_name: body.batch_name as string, dataset_type: datasetType });

  if (existingBatch) {
    return apiError(
      ErrorCodes.CONFLICT,
      `A batch named "${body.batch_name}" already exists for dataset type '${datasetType}'.`,
      409
    );
  }

  const batchId = randomUUID();
  const now = new Date().toISOString();

  // Shuffle and anonymize models
  const tasks = batchData.tasks;
  const { anonymized_tasks, task_models_shuffles } = shuffleAndAnonymizeModels(tasks);

  // Extract model names from first task before anonymization (already anonymized, use shuffles)
  const modelNames = Object.values(task_models_shuffles[tasks[0]?.id] ?? {});

  // Build batch task document
  const batchTask: Record<string, unknown> = {
    batch_id: batchId,
    batch_name: body.batch_name,
    dataset_domain: body.dataset_domain,
    tasks: anonymized_tasks,
    task_models_shuffles,
    ...(datasetType === "mt"
      ? { source_language: body.source_language, target_language: body.target_language }
      : { language: body.language }),
  };
  if (body.rating_guideline) batchTask.rating_guideline = body.rating_guideline;
  if (body.domains) batchTask.domains = body.domains;

  // Build batch detail document
  const batchDetail: BatchDetailTypes = {
    batch_id: batchId,
    batch_name: body.batch_name as string,
    dataset_type: datasetType,
    dataset_domain: body.dataset_domain as string,
    source_language: (body.source_language ?? body.language) as BatchDetailTypes["source_language"],
    target_language: (body.target_language ?? body.language) as BatchDetailTypes["target_language"],
    models: modelNames,
    annotator_id: null,
    created_by: caller.username,
    created_at: now,
    number_of_tasks: tasks.length,
    annotated_tasks: 0,
    qa_id: null,
  };
  if (body.rating_guideline) batchDetail.rating_guideline = body.rating_guideline as BatchDetailTypes["rating_guideline"];
  if (body.domains) batchDetail.domains = body.domains as BatchDetailTypes["domains"];

  await db.collection("batches_details").insertOne(batchDetail);
  await db.collection(`${datasetType}_batches`).insertOne(batchTask);

  const responseData = {
    batch_id: batchId,
    batch_name: body.batch_name,
    dataset_type: datasetType,
    status: "pending",
    number_of_tasks: tasks.length,
    created_at: now,
  };

  // Store idempotency key with TTL
  if (idempotencyKey) {
    await db.collection("api_idempotency_keys").insertOne({
      key: idempotencyKey,
      response: responseData,
      created_at: new Date(),
    });
    // Ensure TTL index (24h)
    db.collection("api_idempotency_keys")
      .createIndex({ created_at: 1 }, { expireAfterSeconds: 86400, background: true })
      .catch(() => {});
  }

  // Emit webhook event (fire and forget)
  emitWebhookEvent("batch.created", responseData);

  return apiSuccess(responseData, 201);
}
