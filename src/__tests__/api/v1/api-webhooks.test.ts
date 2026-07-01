import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { createHmac } from "crypto";
import { getDb, makeMtBatchDetail, makeUser } from "@/test/helpers";

// The global setup mocks @/lib/api-webhooks to a no-op so route tests don't
// fire real HTTP. Here we run the REAL dispatcher and assert its tenant-scoping:
// a listener only receives events for batches its owner may see (plus root).
let emitWebhookEvent: typeof import("@/lib/api-webhooks").emitWebhookEvent;

const fetchMock = vi.fn();

beforeAll(async () => {
  const real = await vi.importActual<typeof import("@/lib/api-webhooks")>(
    "@/lib/api-webhooks"
  );
  emitWebhookEvent = real.emitWebhookEvent;
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

async function seedWebhook(
  owner_email: string,
  url: string,
  overrides: Partial<{ events: string[]; secret: string; active: boolean }> = {}
) {
  const db = await getDb();
  await db.collection("webhooks").insertOne({
    webhook_id: `wh-${url}`,
    owner_email,
    url,
    events: overrides.events ?? ["task.evaluated"],
    secret: overrides.secret ?? "shhh",
    created_at: new Date().toISOString(),
    active: overrides.active ?? true,
  });
}

/** Let the fire-and-forget deliveries settle. */
const flush = () => new Promise((r) => setTimeout(r, 20));

const calledUrls = () => fetchMock.mock.calls.map((c) => c[0] as string);

describe("emitWebhookEvent (real) — tenant scoping", () => {
  beforeEach(async () => {
    fetchMock.mockReset().mockResolvedValue({ ok: true });
    const db = await getDb();
    await db.collection("batches_details").insertOne(
      makeMtBatchDetail({
        batch_id: "batch-001",
        created_by: "owner@example.com",
        annotator_id: "annotator@example.com",
        qa_id: "reviewer@example.com",
      })
    );
    await db
      .collection("user")
      .insertMany([makeUser({ email: "root@example.com", role: "root" })]);
  });

  it("delivers only to owners authorized for the batch, plus root", async () => {
    await seedWebhook("annotator@example.com", "http://hook/annotator");
    await seedWebhook("reviewer@example.com", "http://hook/reviewer");
    await seedWebhook("owner@example.com", "http://hook/owner");
    await seedWebhook("stranger@example.com", "http://hook/stranger");
    await seedWebhook("root@example.com", "http://hook/root");

    await emitWebhookEvent("task.evaluated", {
      batch_id: "batch-001",
      task_id: "1",
    });
    await flush();

    const urls = calledUrls();
    expect(urls).toContain("http://hook/annotator");
    expect(urls).toContain("http://hook/reviewer");
    expect(urls).toContain("http://hook/owner");
    expect(urls).toContain("http://hook/root");
    expect(urls).not.toContain("http://hook/stranger");
    expect(urls).toHaveLength(4);
  });

  it("does not deliver to webhooks not subscribed to the event", async () => {
    await seedWebhook("annotator@example.com", "http://hook/other-event", {
      events: ["batch.created"],
    });

    await emitWebhookEvent("task.evaluated", { batch_id: "batch-001" });
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed for an unknown batch — only root receives", async () => {
    await seedWebhook("annotator@example.com", "http://hook/annotator");
    await seedWebhook("root@example.com", "http://hook/root");

    await emitWebhookEvent("task.evaluated", { batch_id: "does-not-exist" });
    await flush();

    expect(calledUrls()).toEqual(["http://hook/root"]);
  });

  it("signs the payload with the webhook's secret", async () => {
    await seedWebhook("annotator@example.com", "http://hook/annotator", {
      secret: "topsecret",
    });

    await emitWebhookEvent("task.evaluated", {
      batch_id: "batch-001",
      task_id: "1",
    });
    await flush();

    const call = fetchMock.mock.calls.find(
      (c) => c[0] === "http://hook/annotator"
    );
    expect(call).toBeTruthy();
    const init = call![1] as {
      body: string;
      headers: Record<string, string>;
    };
    const expected = createHmac("sha256", "topsecret")
      .update(init.body)
      .digest("hex");
    expect(init.headers["X-HornEval-Signature"]).toBe(expected);
    expect(init.headers["X-HornEval-Event"]).toBe("task.evaluated");
  });
});
