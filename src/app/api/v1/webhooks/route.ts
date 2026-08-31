export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-errors";

const VALID_EVENTS = [
  "batch.created",
  "batch.assigned",
  "batch.completed",
  "tasks.appended",
  "task.evaluated",
  "review.submitted",
];

/** POST /api/v1/webhooks — Register a webhook. */
export async function POST(req: NextRequest) {
  const caller = await resolveApiCaller(req, "webhooks:write");
  if (caller instanceof Response) return caller;

  let body: { url?: string; events?: string[]; secret?: string };
  try {
    body = await req.json();
  } catch {
    return apiError(ErrorCodes.VALIDATION_FAILED, "Invalid JSON body.", 400);
  }

  const url = body.url?.trim();
  const events = body.events;
  const secret = body.secret?.trim();

  if (!url) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "'url' is required.", 400);
  }
  if (!events || !Array.isArray(events) || events.length === 0) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "'events' must be a non-empty array.", 400);
  }
  if (!secret) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "'secret' is required for webhook signature verification.", 400);
  }

  const invalidEvents = events.filter((e) => !VALID_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    return apiError(
      ErrorCodes.VALIDATION_FAILED,
      `Invalid event(s): ${invalidEvents.join(", ")}. Valid: ${VALID_EVENTS.join(", ")}`,
      400
    );
  }

  const webhookId = randomUUID();
  const now = new Date().toISOString();

  const client = await getClientPromise();
  const db = client.db();

  await db.collection("webhooks").insertOne({
    webhook_id: webhookId,
    owner_email: caller.username,
    url,
    events,
    secret,
    created_at: now,
    active: true,
  });

  return apiSuccess(
    { webhook_id: webhookId, url, events, created_at: now },
    201
  );
}

/** GET /api/v1/webhooks — List own webhooks. */
export async function GET(req: NextRequest) {
  const caller = await resolveApiCaller(req, "webhooks:read");
  if (caller instanceof Response) return caller;

  const client = await getClientPromise();
  const db = client.db();

  const webhooks = await db
    .collection("webhooks")
    .find({ owner_email: caller.username, active: true })
    .sort({ created_at: -1 })
    .toArray();

  const data = webhooks.map((w) => ({
    webhook_id: w.webhook_id,
    url: w.url,
    events: w.events,
    created_at: w.created_at,
  }));

  return apiSuccess(data);
}
