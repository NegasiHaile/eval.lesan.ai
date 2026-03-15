export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-errors";
import { validateEvaluationTask } from "@/helpers/validate_evaluation_task";
import { emitWebhookEvent } from "@/lib/api-webhooks";
import type { BatchDetailTypes, EvalTaskTypes, EvalOutputTypes } from "@/types/data";

type RouteParams = { params: Promise<{ batchId: string; taskId: string }> };

/** GET /api/v1/batches/{batchId}/tasks/{taskId} — Single task. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req);
  if (caller instanceof Response) return caller;

  const { batchId, taskId } = await params;
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
  const batch = await db.collection(`${datasetType}_batches`).findOne(
    {
      batch_id: batchId,
      $or: [{ "tasks.id": Number(taskId) }, { "tasks.id": String(taskId) }],
    },
    {
      projection: {
        tasks: {
          $filter: {
            input: "$tasks",
            as: "task",
            cond: {
              $or: [
                { $eq: ["$$task.id", String(taskId)] },
                { $eq: ["$$task.id", Number(taskId)] },
              ],
            },
          },
        },
        _id: 0,
      },
    }
  );

  if (!batch || !batch.tasks?.length) {
    return apiError(
      ErrorCodes.NOT_FOUND,
      `Task '${taskId}' not found in batch '${batchId}'.`,
      404
    );
  }

  return apiSuccess(batch.tasks[0]);
}

/** PATCH /api/v1/batches/{batchId}/tasks/{taskId} — Submit evaluation or reviewer comment. */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req);
  if (caller instanceof Response) return caller;

  const { batchId, taskId } = await params;

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

  const email = caller.username.toLowerCase();
  const isReviewer = detail.qa_id?.toLowerCase() === email;
  const isAnnotator = detail.annotator_id?.toLowerCase() === email;
  const isCreator = detail.created_by?.toLowerCase() === email;
  const isRoot = caller.role.toLowerCase() === "root";

  // Authorization
  if (!isRoot && !isCreator && !isAnnotator && !isReviewer) {
    return apiError(ErrorCodes.FORBIDDEN, "You do not have access to this batch.", 403);
  }

  const datasetType = detail.dataset_type ?? "mt";
  const taskIdMatch = { $or: [{ "tasks.id": Number(taskId) }, { "tasks.id": String(taskId) }] };

  // Reviewer-only: only update reviewer_comment
  if (isReviewer && !isRoot && !isCreator && !isAnnotator) {
    const result = await db.collection(`${datasetType}_batches`).updateOne(
      { batch_id: batchId, ...taskIdMatch },
      { $set: { "tasks.$.reviewer_comment": (body.reviewer_comment as string) ?? "" } }
    );
    if (result.matchedCount === 0) {
      return apiError(ErrorCodes.NOT_FOUND, `Task '${taskId}' not found.`, 404);
    }
    emitWebhookEvent("review.submitted", { batch_id: batchId, task_id: taskId });
    return apiSuccess({ message: "Reviewer comment updated." });
  }

  // Annotator/creator/root: update task evaluation
  const models = body.models as Array<{ model: string; rate: number; rank: number }> | undefined;
  if (!models || !Array.isArray(models)) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "'models' array is required.", 400);
  }

  // Build the updated task for validation
  const taskForValidation: EvalTaskTypes = {
    id: taskId,
    input: "", // not needed for evaluation validation
    models: models.map((m) => ({
      output: "",
      model: m.model,
      rate: m.rate,
      rank: m.rank,
    })) as EvalOutputTypes[],
  };

  const validation = validateEvaluationTask(taskForValidation);
  if (!validation.isValid) {
    const code = validation.message?.includes("Ranking must reflect rating")
      ? ErrorCodes.RATE_RANK_INCONSISTENT
      : ErrorCodes.VALIDATION_FAILED;
    return apiError(code, validation.message ?? "Validation failed.", 400, validation.errorTitles);
  }

  // Build update fields
  const updateFields: Record<string, unknown> = {};
  for (const m of models) {
    // We'll build the full task update below
    updateFields[`tasks.$.models`] = models.map((m) => ({
      ...m,
      output: m.model, // placeholder — we preserve existing output via different approach
    }));
  }

  // Fetch the current task to merge
  const batchDoc = await db.collection(`${datasetType}_batches`).findOne(
    { batch_id: batchId, ...taskIdMatch },
    { projection: { tasks: { $elemMatch: { $or: [{ id: Number(taskId) }, { id: String(taskId) }] } }, _id: 0 } }
  );

  if (!batchDoc?.tasks?.[0]) {
    return apiError(ErrorCodes.NOT_FOUND, `Task '${taskId}' not found.`, 404);
  }

  const existingTask = batchDoc.tasks[0] as EvalTaskTypes;

  // Merge models: update rate/rank from body, keep output from existing
  const updatedModels = existingTask.models.map((existing) => {
    const update = models.find((m) => m.model === existing.model);
    if (update) {
      return { ...existing, rate: update.rate, rank: update.rank };
    }
    return existing;
  });

  const updatedTask: Record<string, unknown> = {
    ...existingTask,
    models: updatedModels,
  };

  if (body.reference !== undefined) updatedTask.reference = body.reference;
  if (body.domain !== undefined) updatedTask.domain = body.domain;
  if (body.started_at !== undefined) updatedTask.started_at = body.started_at;
  if (body.completed_at !== undefined) updatedTask.completed_at = body.completed_at;
  if (body.active_duration_ms !== undefined) updatedTask.active_duration_ms = body.active_duration_ms;
  if (body.reviewer_comment !== undefined) updatedTask.reviewer_comment = body.reviewer_comment;

  const result = await db.collection(`${datasetType}_batches`).updateOne(
    { batch_id: batchId, ...taskIdMatch },
    { $set: { "tasks.$": updatedTask } }
  );

  if (result.matchedCount === 0) {
    return apiError(ErrorCodes.NOT_FOUND, `Task '${taskId}' not found.`, 404);
  }

  // Recount annotated tasks and update batches_details
  const fullBatch = await db.collection(`${datasetType}_batches`).findOne({ batch_id: batchId });
  if (fullBatch && Array.isArray(fullBatch.tasks)) {
    const ratedCount = fullBatch.tasks.filter(
      (t: EvalTaskTypes) =>
        Array.isArray(t.models) &&
        t.models.some((m: EvalOutputTypes) => Number(m.rate) !== 0)
    ).length;
    await db.collection("batches_details").updateOne(
      { batch_id: batchId },
      { $set: { annotated_tasks: ratedCount } }
    );
  }

  // Emit webhook events
  emitWebhookEvent("task.evaluated", { batch_id: batchId, task_id: taskId });

  // Check if batch is now fully annotated
  if (fullBatch && Array.isArray(fullBatch.tasks)) {
    const allTasks = fullBatch.tasks as EvalTaskTypes[];
    const allAnnotated = allTasks.every(
      (t) => Array.isArray(t.models) && t.models.some((m: EvalOutputTypes) => Number(m.rate) !== 0)
    );
    if (allAnnotated) {
      emitWebhookEvent("batch.completed", { batch_id: batchId });
    }
  }

  return apiSuccess({ message: "Task updated.", task_id: taskId });
}
