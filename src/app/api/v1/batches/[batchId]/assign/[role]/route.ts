export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiError, ErrorCodes } from "@/lib/api-errors";
import type { BatchDetailTypes } from "@/types/data";

type RouteParams = { params: Promise<{ batchId: string; role: string }> };

/** DELETE /api/v1/batches/{batchId}/assign/{role} — Unassign annotator or reviewer. */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req, "batches:write");
  if (caller instanceof Response) return caller;

  const { batchId, role: assignRole } = await params;
  const normalizedRole = assignRole.toLowerCase();

  if (!["annotator", "reviewer"].includes(normalizedRole)) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "Role must be 'annotator' or 'reviewer'.", 400);
  }

  const client = await getClientPromise();
  const db = client.db();

  const detail = await db
    .collection<BatchDetailTypes>("batches_details")
    .findOne({ batch_id: batchId });

  if (!detail) {
    return apiError(ErrorCodes.NOT_FOUND, `Batch '${batchId}' not found.`, 404);
  }

  const isRoot = caller.role.toLowerCase() === "root";
  const isCreator = detail.created_by?.toLowerCase() === caller.username.toLowerCase();

  if (normalizedRole === "reviewer" && !isRoot) {
    return apiError(ErrorCodes.FORBIDDEN, "Only root users can unassign reviewers.", 403);
  }
  if (normalizedRole === "annotator" && !isRoot && !isCreator) {
    return apiError(ErrorCodes.FORBIDDEN, "Only the batch creator or root can unassign annotators.", 403);
  }

  const field = normalizedRole === "annotator" ? "annotator_id" : "qa_id";
  await db.collection("batches_details").updateOne(
    { batch_id: batchId },
    { $set: { [field]: null } }
  );

  return new Response(null, { status: 204 });
}
