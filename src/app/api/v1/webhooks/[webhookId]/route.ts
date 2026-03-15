export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiError, ErrorCodes } from "@/lib/api-errors";

type RouteParams = { params: Promise<{ webhookId: string }> };

/** DELETE /api/v1/webhooks/{webhookId} — Remove a webhook. */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req);
  if (caller instanceof Response) return caller;

  const { webhookId } = await params;
  const client = await getClientPromise();
  const db = client.db();

  const result = await db.collection("webhooks").updateOne(
    { webhook_id: webhookId, owner_email: caller.username, active: true },
    { $set: { active: false } }
  );

  if (result.matchedCount === 0) {
    return apiError(ErrorCodes.NOT_FOUND, "Webhook not found or already removed.", 404);
  }

  return new Response(null, { status: 204 });
}
