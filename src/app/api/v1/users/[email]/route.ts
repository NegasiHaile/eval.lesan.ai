export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-errors";

type RouteParams = { params: Promise<{ email: string }> };

/** PATCH /api/v1/users/{email} — Update role/active status (root only). */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req, "users:write");
  if (caller instanceof Response) return caller;

  if (caller.role.toLowerCase() !== "root") {
    return apiError(ErrorCodes.FORBIDDEN, "Only root users can update user profiles.", 403);
  }

  const { email } = await params;
  const decodedEmail = decodeURIComponent(email);

  let body: { role?: string; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return apiError(ErrorCodes.VALIDATION_FAILED, "Invalid JSON body.", 400);
  }

  const update: Record<string, unknown> = {};
  if (body.role !== undefined) update.role = body.role;
  if (body.active !== undefined) update.active = body.active;

  if (Object.keys(update).length === 0) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "No valid fields to update. Provide 'role' or 'active'.", 400);
  }

  const client = await getClientPromise();
  const db = client.db();

  const escaped = decodedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const result = await db.collection("user").updateOne(
    { email: { $regex: new RegExp(`^${escaped}$`, "i") } },
    { $set: update }
  );

  if (result.matchedCount === 0) {
    return apiError(ErrorCodes.NOT_FOUND, `User '${decodedEmail}' not found.`, 404);
  }

  return apiSuccess({ email: decodedEmail, updated_fields: Object.keys(update) });
}
