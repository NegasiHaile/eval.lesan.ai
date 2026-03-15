export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-errors";
import type { BatchDetailTypes, EvalTaskTypes } from "@/types/data";

type RouteParams = { params: Promise<{ batchId: string }> };

/** GET /api/v1/batches/{batchId}/tasks — Paginated task list. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req);
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
    tasks = tasks.filter(
      (t) => !t.models?.some((m) => Number(m.rate) !== 0)
    );
  } else if (statusFilter === "completed") {
    tasks = tasks.filter(
      (t) => t.models?.some((m) => Number(m.rate) !== 0)
    );
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
