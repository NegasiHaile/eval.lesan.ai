export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-errors";
import type { BatchDetailTypes } from "@/types/data";

type RouteParams = { params: Promise<{ batchId: string }> };

/** GET /api/v1/batches/{batchId} — Full batch with tasks. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req);
  if (caller instanceof Response) return caller;

  const { batchId } = await params;
  const client = await getClientPromise();
  const db = client.db();

  // Look up dataset_type from batches_details (flat addressing)
  const detail = await db
    .collection<BatchDetailTypes>("batches_details")
    .findOne({ batch_id: batchId });

  if (!detail) {
    return apiError(ErrorCodes.NOT_FOUND, `Batch '${batchId}' not found.`, 404);
  }

  // Authorization: non-root can only see their own batches
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

  if (!batch) {
    return apiError(ErrorCodes.NOT_FOUND, `Batch task data for '${batchId}' not found.`, 404);
  }

  const includeShuffles =
    req.nextUrl.searchParams.get("include_shuffles") === "true";

  const result: Record<string, unknown> = { ...batch };
  delete result._id;
  if (!includeShuffles) delete result.task_models_shuffles;

  // Merge in detail metadata
  result.dataset_type = datasetType;
  result.annotator_id = detail.annotator_id;
  result.qa_id = detail.qa_id;
  result.created_by = detail.created_by;
  result.created_at = detail.created_at;
  result.number_of_tasks = detail.number_of_tasks;
  result.annotated_tasks = detail.annotated_tasks;

  return apiSuccess(result);
}

/** PATCH /api/v1/batches/{batchId} — Update batch metadata. */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req);
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

  // Only creator or root can update
  if (caller.role !== "root" && detail.created_by?.toLowerCase() !== caller.username.toLowerCase()) {
    return apiError(ErrorCodes.FORBIDDEN, "Only the batch creator or root can update this batch.", 403);
  }

  // Allowlist of updatable fields
  const allowedFields = ["batch_name", "dataset_domain", "rating_guideline", "domains"];
  const detailUpdate: Record<string, unknown> = {};
  const batchUpdate: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in body) {
      detailUpdate[field] = body[field];
      batchUpdate[field] = body[field];
    }
  }

  if (Object.keys(detailUpdate).length === 0) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "No valid fields to update.", 400);
  }

  const datasetType = detail.dataset_type ?? "mt";

  await Promise.all([
    db.collection("batches_details").updateOne({ batch_id: batchId }, { $set: detailUpdate }),
    db.collection(`${datasetType}_batches`).updateOne({ batch_id: batchId }, { $set: batchUpdate }),
  ]);

  return apiSuccess({ batch_id: batchId, updated_fields: Object.keys(detailUpdate) });
}

/** DELETE /api/v1/batches/{batchId} — Delete batch + tasks. */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req);
  if (caller instanceof Response) return caller;

  const { batchId } = await params;
  const client = await getClientPromise();
  const db = client.db();

  const detail = await db
    .collection<BatchDetailTypes>("batches_details")
    .findOne({ batch_id: batchId });

  if (!detail) {
    return apiError(ErrorCodes.NOT_FOUND, `Batch '${batchId}' not found.`, 404);
  }

  // Only creator or root can delete
  const isRoot = caller.role.toLowerCase() === "root";
  const isCreator = detail.created_by?.toLowerCase() === caller.username.toLowerCase();
  if (!isRoot && !isCreator) {
    return apiError(ErrorCodes.FORBIDDEN, "Only the batch creator or a root user can delete this batch.", 403);
  }

  const datasetType = detail.dataset_type ?? "mt";

  await Promise.all([
    db.collection("batches_details").deleteOne({ batch_id: batchId }),
    db.collection(`${datasetType}_batches`).deleteOne({ batch_id: batchId }),
  ]);

  return new Response(null, { status: 204 });
}
