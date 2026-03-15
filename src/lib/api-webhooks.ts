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
 * Emit a webhook event to all registered listeners.
 * Non-blocking — errors are swallowed silently.
 */
export async function emitWebhookEvent(
  event: WebhookEvent,
  payload: object
): Promise<void> {
  try {
    const client = await getClientPromise();
    const db = client.db();

    const webhooks = await db
      .collection<WebhookRecord>("webhooks")
      .find({ active: true, events: event })
      .toArray();

    // Fire and forget all deliveries
    for (const wh of webhooks) {
      deliverWebhook(wh.url, event, payload, wh.secret).catch(() => {});
    }
  } catch {
    // Swallow — webhooks should never break core operations
  }
}
