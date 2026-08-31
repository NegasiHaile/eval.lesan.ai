export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-errors";
import { validateEvaluationTask } from "@/helpers/validate_evaluation_task";
import {
  countAnnotatedTasks,
  countReviewedTasks,
  isTaskAnnotated,
} from "@/helpers/annotation_progress";
import { emitWebhookEvent } from "@/lib/api-webhooks";
import type { BatchDetailTypes, EvalTaskTypes, EvalOutputTypes } from "@/types/data";

type RouteParams = { params: Promise<{ batchId: string; taskId: string }> };

/** GET /api/v1/batches/{batchId}/tasks/{taskId} — Single task. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req, "tasks:read");
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
  const caller = await resolveApiCaller(req, "tasks:write");
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
  const isAnnotation = datasetType === "tts" && detail.workflow === "annotation";
  const taskIdMatch = { $or: [{ "tasks.id": Number(taskId) }, { "tasks.id": String(taskId) }] };

  // Reviewer-only path. A TTS reviewer's remedies are to correct the prompt text
  // or to exclude the segment — never to touch the audio, which cannot be edited.
  // Correcting text deliberately KEEPS any existing recording: when audio and
  // text disagree, fixing the text to match what was said is the repair.
  if (isReviewer && !isRoot && !isCreator && !isAnnotator) {
    const hasComment = body.reviewer_comment !== undefined;
    const hasInput = body.input !== undefined;
    const hasExcluded = body.excluded !== undefined;

    if (!hasComment && !hasInput && !hasExcluded) {
      return apiError(
        ErrorCodes.VALIDATION_FAILED,
        "Provide at least one of 'reviewer_comment', 'input', or 'excluded'.",
        400
      );
    }
    if (hasInput && !(typeof body.input === "string" && body.input.trim())) {
      return apiError(
        ErrorCodes.VALIDATION_FAILED,
        "'input' must be a non-empty string.",
        400
      );
    }
    if (hasExcluded && typeof body.excluded !== "boolean") {
      return apiError(ErrorCodes.VALIDATION_FAILED, "'excluded' must be a boolean.", 400);
    }
    // Changing what a segment says, or dropping it, needs a stated reason —
    // otherwise the corpus carries edits nobody can account for later.
    if ((hasInput || body.excluded === true) && !(body.reviewer_comment as string | undefined)?.trim()) {
      return apiError(
        ErrorCodes.VALIDATION_FAILED,
        "'reviewer_comment' is required when editing the text or excluding a segment.",
        400
      );
    }

    const set: Record<string, unknown> = { "tasks.$.reviewed_at": new Date().toISOString() };
    if (hasComment) set["tasks.$.reviewer_comment"] = body.reviewer_comment as string;
    if (hasInput) set["tasks.$.input"] = (body.input as string).trim();
    if (hasExcluded) set["tasks.$.excluded"] = body.excluded as boolean;

    const result = await db
      .collection(`${datasetType}_batches`)
      .updateOne({ batch_id: batchId, ...taskIdMatch }, { $set: set });
    if (result.matchedCount === 0) {
      return apiError(ErrorCodes.NOT_FOUND, `Task '${taskId}' not found.`, 404);
    }

    // Excluding a segment resolves it, so both progress counters can move.
    const reviewedBatch = await db
      .collection(`${datasetType}_batches`)
      .findOne({ batch_id: batchId });
    if (reviewedBatch && Array.isArray(reviewedBatch.tasks)) {
      const tasks = reviewedBatch.tasks as EvalTaskTypes[];
      await db.collection("batches_details").updateOne(
        { batch_id: batchId },
        {
          $set: {
            reviewed_tasks: countReviewedTasks(tasks),
            annotated_tasks: countAnnotatedTasks(tasks, detail.workflow),
          },
        }
      );
    }

    emitWebhookEvent("review.submitted", { batch_id: batchId, task_id: taskId });
    return apiSuccess({ message: "Review saved.", task_id: taskId });
  }

  // Annotator/creator/root: update task evaluation.
  // A TTS annotation task carries no model outputs — the recording referenced by
  // `reference` is the submission — so `models` is optional there and the
  // reference itself is what we require instead.
  const models = body.models as Array<{ model: string; rate: number; rank: number }> | undefined;
  if (models !== undefined && !Array.isArray(models)) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "'models' must be an array.", 400);
  }
  if (!isAnnotation && !models) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "'models' array is required.", 400);
  }
  if (isAnnotation && !(typeof body.reference === "string" && body.reference.trim())) {
    return apiError(
      ErrorCodes.VALIDATION_FAILED,
      "'reference' is required for TTS annotation tasks — it holds the uploaded recording's file_id.",
      400
    );
  }

  // Build the updated task for validation
  const taskForValidation: EvalTaskTypes = {
    id: taskId,
    input: "", // not needed for evaluation validation
    models: (models ?? []).map((m) => ({
      output: "",
      model: m.model,
      rate: m.rate,
      rank: m.rank,
    })) as EvalOutputTypes[],
  };

  // An annotation submission carries no models, and every rate/rank rule below
  // is vacuous over an empty list — so this validates evaluations fully while
  // letting a recording-only submission through.
  const validation = validateEvaluationTask(taskForValidation);
  if (!validation.isValid) {
    const code = validation.message?.includes("Ranking must reflect rating")
      ? ErrorCodes.RATE_RANK_INCONSISTENT
      : ErrorCodes.VALIDATION_FAILED;
    return apiError(code, validation.message ?? "Validation failed.", 400, validation.errorTitles);
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
  const updatedModels = (existingTask.models ?? []).map((existing) => {
    const update = models?.find((m) => m.model === existing.model);
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
  // reviewer_comment is reviewer/root territory — annotators must not set it
  // through the evaluation path.
  if (body.reviewer_comment !== undefined && (isReviewer || isRoot)) {
    updatedTask.reviewer_comment = body.reviewer_comment;
  }

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
    const annotatedCount = countAnnotatedTasks(
      fullBatch.tasks as EvalTaskTypes[],
      detail.workflow
    );
    await db.collection("batches_details").updateOne(
      { batch_id: batchId },
      { $set: { annotated_tasks: annotatedCount } }
    );
  }

  // Emit webhook events
  emitWebhookEvent("task.evaluated", { batch_id: batchId, task_id: taskId });

  // Check if batch is now fully annotated
  if (fullBatch && Array.isArray(fullBatch.tasks)) {
    const allTasks = fullBatch.tasks as EvalTaskTypes[];
    const allAnnotated = allTasks.every((t) => isTaskAnnotated(t, detail.workflow));
    if (allAnnotated) {
      emitWebhookEvent("batch.completed", { batch_id: batchId });
    }
  }

  return apiSuccess({ message: "Task updated.", task_id: taskId });
}
