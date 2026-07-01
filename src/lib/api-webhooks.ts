/**
 * Webhook dispatcher for HornEval API events.
 * Signs payloads with HMAC-SHA256, async fire-and-forget with retry.
 */

import { createHmac } from "crypto";
import getClientPromise from "@/lib/mongodb";

export type WebhookEvent =
  | "batch.created"
  | "batch.assigned"
  | "batch.completed"
  | "task.evaluated"
  | "review.submitted";

type WebhookRecord = {
  owner_email: string;
  url: string;
  events: string[];
  secret: string;
  created_at: string;
  active: boolean;
};

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function deliverWebhook(
  url: string,
  event: string,
  payload: object,
  secret: string,
  retries = 3
): Promise<void> {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const signature = signPayload(body, secret);

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-HornEval-Signature": signature,
          "X-HornEval-Event": event,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return;
    } catch {
      // Retry on network error
    }
    // Exponential backoff
    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}

/**
 * Emit a webhook event to registered listeners.
 *
 * Delivery is scoped by authorization: a webhook only fires for a batch its
 * owner is allowed to see (creator / annotator / reviewer), plus root users
 * who may observe any event. This prevents a listener from harvesting events
 * (batch ids, names, task ids) for batches belonging to other users.
 *
 * Non-blocking — errors are swallowed silently.
 */
export async function emitWebhookEvent(
  event: WebhookEvent,
  payload: { batch_id?: string } & Record<string, unknown>
): Promise<void> {
  try {
    const client = await getClientPromise();
    const db = client.db();

    const webhooks = await db
      .collection<WebhookRecord>("webhooks")
      .find({ active: true, events: event })
      .toArray();

    if (webhooks.length === 0) return;

    // Emails authorized to receive events for this batch. `null` means the
    // event carries no batch context, so no per-batch restriction applies.
    let authorized: Set<string> | null = null;
    if (payload.batch_id) {
      const detail = await db
        .collection("batches_details")
        .findOne({ batch_id: payload.batch_id });
      authorized = new Set(
        [detail?.created_by, detail?.annotator_id, detail?.qa_id]
          .filter((e): e is string => typeof e === "string")
          .map((e) => e.toLowerCase())
      );
    }

    // Root owners may receive any event regardless of batch ownership.
    const owners = [...new Set(webhooks.map((w) => w.owner_email))];
    const rootDocs = await db
      .collection("user")
      .find({ email: { $in: owners }, role: "root" })
      .project({ email: 1 })
      .toArray();
    const roots = new Set(
      rootDocs.map((u) => (u.email as string).toLowerCase())
    );

    // Fire and forget authorized deliveries
    for (const wh of webhooks) {
      const owner = wh.owner_email.toLowerCase();
      const allowed = roots.has(owner) || (authorized ? authorized.has(owner) : true);
      if (!allowed) continue;
      deliverWebhook(wh.url, event, payload, wh.secret).catch(() => {});
    }
  } catch {
    // Swallow — webhooks should never break core operations
  }
}
