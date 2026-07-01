export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import getClientPromise from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { apiError, ErrorCodes } from "@/lib/api-errors";

type RouteParams = { params: Promise<{ keyId: string }> };

/** DELETE — Revoke an API key (soft delete). */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { keyId } = await params;

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(keyId);
  } catch {
    return apiError(ErrorCodes.NOT_FOUND, "Invalid key ID.", 404);
  }

  const client = await getClientPromise();
  const db = client.db();

  const result = await db.collection("api_keys").updateOne(
    {
      _id: objectId,
      owner_email: auth.username,
      active: true,
    },
    { $set: { active: false } }
  );

  if (result.matchedCount === 0) {
    return apiError(
      ErrorCodes.NOT_FOUND,
      "API key not found or already revoked.",
      404
    );
  }

  return new Response(null, { status: 204 });
}
