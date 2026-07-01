export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-errors";
import { calculateLeaderboard } from "@/helpers/batch_leaderboard_calculator";
import type { BatchDetailTypes, EvalTaskTypes, EvalOutputTypes } from "@/types/data";

type RouteParams = { params: Promise<{ batchId: string }> };

/** GET /api/v1/batches/{batchId}/results — Computed leaderboard. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req, "batches:read");
  if (caller instanceof Response) return caller;

  const { batchId } = await params;
  const includeOriginalModels =
    req.nextUrl.searchParams.get("include_original_models") === "true";

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

  const tasks: EvalTaskTypes[] = batch.tasks;
  const evaluatedTasks = tasks.filter(
    (t) => Array.isArray(t.models) && t.models.some((m: EvalOutputTypes) => Number(m.rate) !== 0)
  );

  if (evaluatedTasks.length === 0) {
    return apiError(
      "UNPROCESSABLE_ENTITY",
      "No completed evaluations found for this batch.",
      422
    );
  }

  const shuffles = includeOriginalModels
    ? (batch.task_models_shuffles as Record<string, Record<string, string>> | undefined)
    : undefined;

  const leaderboard = calculateLeaderboard(evaluatedTasks, shuffles);

  const reviewedTasks = tasks.filter((t) => !!t.reviewer_comment).length;
  const totalDuration = evaluatedTasks.reduce(
    (sum, t) => sum + (t.active_duration_ms ?? 0),
    0
  );

  return apiSuccess({
    leaderboard,
    summary: {
      total_tasks: tasks.length,
      annotated_tasks: evaluatedTasks.length,
      reviewed_tasks: reviewedTasks,
      avg_annotation_time_ms:
        evaluatedTasks.length > 0
          ? Math.round(totalDuration / evaluatedTasks.length)
          : 0,
    },
  });
}
