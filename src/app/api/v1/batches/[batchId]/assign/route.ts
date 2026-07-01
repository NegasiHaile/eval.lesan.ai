export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-errors";
import { emitWebhookEvent } from "@/lib/api-webhooks";
import type { BatchDetailTypes } from "@/types/data";

type RouteParams = { params: Promise<{ batchId: string }> };

/** POST /api/v1/batches/{batchId}/assign — Assign annotator or reviewer. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req, "batches:write");
  if (caller instanceof Response) return caller;

  const { batchId } = await params;

  let body: { role?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return apiError(ErrorCodes.VALIDATION_FAILED, "Invalid JSON body.", 400);
  }

  const assignRole = body.role?.toLowerCase();
  const email = body.email?.trim();

  if (!assignRole || !["annotator", "reviewer"].includes(assignRole)) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "'role' must be 'annotator' or 'reviewer'.", 400);
  }
  if (!email) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "'email' is required.", 400);
  }

  const client = await getClientPromise();
  const db = client.db();

  const detail = await db
    .collection<BatchDetailTypes>("batches_details")
    .findOne({ batch_id: batchId });

  if (!detail) {
    return apiError(ErrorCodes.NOT_FOUND, `Batch '${batchId}' not found.`, 404);
  }

  // Authorization
  const isRoot = caller.role.toLowerCase() === "root";
  const isCreator = detail.created_by?.toLowerCase() === caller.username.toLowerCase();

  if (assignRole === "reviewer" && !isRoot) {
    return apiError(ErrorCodes.FORBIDDEN, "Only root users can assign reviewers.", 403);
  }
  if (assignRole === "annotator" && !isRoot && !isCreator) {
    return apiError(ErrorCodes.FORBIDDEN, "Only the batch creator or root can assign annotators.", 403);
  }

  // Validate user exists
  const user = await db.collection("user").findOne({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } });
  if (!user) {
    return apiError(ErrorCodes.NOT_FOUND, `User '${email}' not found.`, 404);
  }

  // Check if already assigned
  const field = assignRole === "annotator" ? "annotator_id" : "qa_id";
  if (detail[field]) {
    return apiError(
      ErrorCodes.CONFLICT,
      `Batch already has a ${assignRole} assigned. Use PUT to reassign.`,
      409
    );
  }

  await db.collection("batches_details").updateOne(
    { batch_id: batchId },
    { $set: { [field]: email } }
  );

  const assignResult = {
    batch_id: batchId,
    role: assignRole,
    email,
    assigned_at: new Date().toISOString(),
    status: "assigned",
  };

  emitWebhookEvent("batch.assigned", assignResult);

  return apiSuccess(assignResult);
}

/** PUT /api/v1/batches/{batchId}/assign — Reassign (replace current assignee). */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req, "batches:write");
  if (caller instanceof Response) return caller;

  const { batchId } = await params;

  let body: { role?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return apiError(ErrorCodes.VALIDATION_FAILED, "Invalid JSON body.", 400);
  }

  const assignRole = body.role?.toLowerCase();
  const email = body.email?.trim();

  if (!assignRole || !["annotator", "reviewer"].includes(assignRole)) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "'role' must be 'annotator' or 'reviewer'.", 400);
  }
  if (!email) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "'email' is required.", 400);
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

  if (assignRole === "reviewer" && !isRoot) {
    return apiError(ErrorCodes.FORBIDDEN, "Only root users can reassign reviewers.", 403);
  }
  if (assignRole === "annotator" && !isRoot && !isCreator) {
    return apiError(ErrorCodes.FORBIDDEN, "Only the batch creator or root can reassign annotators.", 403);
  }

  // Validate user exists
  const user = await db.collection("user").findOne({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } });
  if (!user) {
    return apiError(ErrorCodes.NOT_FOUND, `User '${email}' not found.`, 404);
  }

  const field = assignRole === "annotator" ? "annotator_id" : "qa_id";
  await db.collection("batches_details").updateOne(
    { batch_id: batchId },
    { $set: { [field]: email } }
  );

  const reassignResult = {
    batch_id: batchId,
    role: assignRole,
    email,
    assigned_at: new Date().toISOString(),
    status: "reassigned",
  };

  emitWebhookEvent("batch.assigned", reassignResult);

  return apiSuccess(reassignResult);
}
