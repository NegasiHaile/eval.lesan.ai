import { describe, it, expect, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/v1/webhooks/route";
import { DELETE } from "@/app/api/v1/webhooks/[webhookId]/route";
import {
  makeRequest,
  makeJsonRequest,
  mockCaller,
  CALLERS,
  json,
  getDb,
} from "@/test/helpers";

describe("Webhooks", () => {
  beforeEach(() => {
    mockCaller(CALLERS.root);
  });

  describe("POST /api/v1/webhooks", () => {
    it("registers a webhook", async () => {
      const req = makeJsonRequest("/api/v1/webhooks", "POST", {
        url: "https://example.com/hook",
        events: ["batch.created", "task.evaluated"],
        secret: "my-secret-123",
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await json(res);
      expect(body.data.webhook_id).toBeTruthy();
      expect(body.data.url).toBe("https://example.com/hook");
      expect(body.data.events).toEqual(["batch.created", "task.evaluated"]);
    });

    it("rejects missing url", async () => {
      const req = makeJsonRequest("/api/v1/webhooks", "POST", {
        events: ["batch.created"],
        secret: "secret",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects missing events", async () => {
      const req = makeJsonRequest("/api/v1/webhooks", "POST", {
        url: "https://example.com/hook",
        secret: "secret",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects missing secret", async () => {
      const req = makeJsonRequest("/api/v1/webhooks", "POST", {
        url: "https://example.com/hook",
        events: ["batch.created"],
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects invalid event types", async () => {
      const req = makeJsonRequest("/api/v1/webhooks", "POST", {
        url: "https://example.com/hook",
        events: ["batch.created", "invalid.event"],
        secret: "secret",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.error.message).toContain("invalid.event");
    });
  });

  describe("GET /api/v1/webhooks", () => {
    it("lists own webhooks", async () => {
      const db = await getDb();
      await db.collection("webhooks").insertMany([
        {
          webhook_id: "wh-1",
          owner_email: "root@example.com",
          url: "https://example.com/hook1",
          events: ["batch.created"],
          secret: "s1",
          created_at: new Date().toISOString(),
          active: true,
        },
        {
          webhook_id: "wh-2",
          owner_email: "other@example.com",
          url: "https://other.com/hook",
          events: ["batch.created"],
          secret: "s2",
          created_at: new Date().toISOString(),
          active: true,
        },
      ]);

      const req = makeRequest("/api/v1/webhooks");
      const res = await GET(req);
      const body = await json(res);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].webhook_id).toBe("wh-1");
      // Should not expose secret
      expect(body.data[0].secret).toBeUndefined();
    });

    it("excludes inactive webhooks", async () => {
      const db = await getDb();
      await db.collection("webhooks").insertOne({
        webhook_id: "wh-inactive",
        owner_email: "root@example.com",
        url: "https://example.com/old",
        events: ["batch.created"],
        secret: "s",
        created_at: new Date().toISOString(),
        active: false,
      });

      const req = makeRequest("/api/v1/webhooks");
      const res = await GET(req);
      const body = await json(res);
      expect(body.data).toHaveLength(0);
    });
  });

  describe("DELETE /api/v1/webhooks/:webhookId", () => {
    it("removes a webhook (soft delete)", async () => {
      const db = await getDb();
      await db.collection("webhooks").insertOne({
        webhook_id: "wh-del",
        owner_email: "root@example.com",
        url: "https://example.com/hook",
        events: ["batch.created"],
        secret: "s",
        created_at: new Date().toISOString(),
        active: true,
      });

      const req = makeRequest("/api/v1/webhooks/wh-del", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ webhookId: "wh-del" }) });
      expect(res.status).toBe(204);

      const doc = await db.collection("webhooks").findOne({ webhook_id: "wh-del" });
      expect(doc!.active).toBe(false);
    });

    it("returns 404 for nonexistent webhook", async () => {
      const req = makeRequest("/api/v1/webhooks/nope", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ webhookId: "nope" }) });
      expect(res.status).toBe(404);
    });

    it("cannot delete another user's webhook", async () => {
      const db = await getDb();
      await db.collection("webhooks").insertOne({
        webhook_id: "wh-other",
        owner_email: "other@example.com",
        url: "https://other.com/hook",
        events: ["batch.created"],
        secret: "s",
        created_at: new Date().toISOString(),
        active: true,
      });

      const req = makeRequest("/api/v1/webhooks/wh-other", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ webhookId: "wh-other" }) });
      expect(res.status).toBe(404); // appears as not found since filtered by owner
    });
  });
});
