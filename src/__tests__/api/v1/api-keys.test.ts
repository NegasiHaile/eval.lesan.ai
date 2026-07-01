import { describe, it, expect, beforeEach } from "vitest";
import { POST, GET } from "@/app/api/v1/api-keys/route";
import { DELETE } from "@/app/api/v1/api-keys/[keyId]/route";
import {
  makeRequest,
  makeJsonRequest,
  mockSession,
  json,
  getDb,
} from "@/test/helpers";

describe("API Keys", () => {
  beforeEach(() => {
    mockSession({ username: "alice@example.com", role: "user" });
  });

  describe("POST /api/v1/api-keys", () => {
    it("creates a key and returns plaintext", async () => {
      const req = makeJsonRequest("/api/v1/api-keys", "POST", {
        name: "My Key",
        scopes: ["batches:read"],
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await json(res);
      expect(body.data.key).toMatch(/^heval_/);
      expect(body.data.key_prefix).toMatch(/^heval_/);
      expect(body.data.name).toBe("My Key");
      expect(body.data.scopes).toEqual(["batches:read"]);
    });

    it("defaults scopes to wildcard", async () => {
      const req = makeJsonRequest("/api/v1/api-keys", "POST", {
        name: "Default Scopes",
      });
      const res = await POST(req);
      const body = await json(res);
      expect(body.data.scopes).toEqual(["*"]);
    });

    it("sets expiration when expires_in_days provided", async () => {
      const req = makeJsonRequest("/api/v1/api-keys", "POST", {
        name: "Expiring Key",
        expires_in_days: 30,
      });
      const res = await POST(req);
      const body = await json(res);
      expect(body.data.expires_at).toBeTruthy();
    });

    it("rejects missing name", async () => {
      const req = makeJsonRequest("/api/v1/api-keys", "POST", {});
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("returns 401 without session", async () => {
      // Reset to unauthenticated
      const mod = await import("@/lib/auth");
      const { vi } = await import("vitest");
      vi.mocked(mod.requireAuth).mockResolvedValue(
        new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 })
      );
      const req = makeJsonRequest("/api/v1/api-keys", "POST", { name: "x" });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/api-keys", () => {
    it("lists own keys without key_hash", async () => {
      const db = await getDb();
      await db.collection("api_keys").insertOne({
        key_hash: "abc123",
        key_prefix: "heval_ab...",
        owner_email: "alice@example.com",
        name: "Test Key",
        role: "user",
        scopes: ["*"],
        created_at: new Date().toISOString(),
        last_used_at: null,
        expires_at: null,
        active: true,
      });

      const req = makeRequest("/api/v1/api-keys");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("Test Key");
      expect(body.data[0].key_hash).toBeUndefined();
      expect(body.data[0].id).toBeTruthy();
    });

    it("does not list revoked keys", async () => {
      const db = await getDb();
      await db.collection("api_keys").insertOne({
        key_hash: "revoked",
        key_prefix: "heval_rv...",
        owner_email: "alice@example.com",
        name: "Revoked",
        role: "user",
        scopes: ["*"],
        created_at: new Date().toISOString(),
        last_used_at: null,
        expires_at: null,
        active: false,
      });

      const req = makeRequest("/api/v1/api-keys");
      const res = await GET(req);
      const body = await json(res);
      expect(body.data).toHaveLength(0);
    });
  });

  describe("DELETE /api/v1/api-keys/:keyId", () => {
    it("revokes a key (soft delete)", async () => {
      const db = await getDb();
      const { insertedId } = await db.collection("api_keys").insertOne({
        key_hash: "to-revoke",
        key_prefix: "heval_tr...",
        owner_email: "alice@example.com",
        name: "To Revoke",
        role: "user",
        scopes: ["*"],
        created_at: new Date().toISOString(),
        last_used_at: null,
        expires_at: null,
        active: true,
      });

      const req = makeRequest(`/api/v1/api-keys/${insertedId}`, { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ keyId: insertedId.toString() }) });
      expect(res.status).toBe(204);

      const doc = await db.collection("api_keys").findOne({ _id: insertedId });
      expect(doc!.active).toBe(false);
    });

    it("returns 404 for invalid key ID", async () => {
      const req = makeRequest("/api/v1/api-keys/not-an-id", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ keyId: "not-an-id" }) });
      expect(res.status).toBe(404);
    });

    it("returns 404 for nonexistent key", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      const req = makeRequest(`/api/v1/api-keys/${fakeId}`, { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ keyId: fakeId }) });
      expect(res.status).toBe(404);
    });
  });
});
