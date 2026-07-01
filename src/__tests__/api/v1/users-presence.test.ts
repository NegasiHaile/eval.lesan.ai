import { describe, it, expect, beforeEach } from "vitest";
import { GET as ListUsers } from "@/app/api/v1/users/route";
import { GET as GetMe } from "@/app/api/v1/users/me/route";
import { PATCH as UpdateUser } from "@/app/api/v1/users/[email]/route";
import { GET as GetPresence } from "@/app/api/v1/presence/route";
import {
  makeRequest,
  makeJsonRequest,
  mockCaller,
  CALLERS,
  json,
  getDb,
  makeUser,
} from "@/test/helpers";

describe("Users", () => {
  beforeEach(async () => {
    mockCaller(CALLERS.root);
    const db = await getDb();
    await db.collection("user").insertMany([
      makeUser({ email: "root@example.com", name: "Root User", role: "root" }),
      makeUser({ email: "user@example.com", name: "Regular User", role: "user" }),
      makeUser({ email: "ann@example.com", name: "Annotator", role: "user" }),
    ]);
  });

  describe("GET /api/v1/users (root only)", () => {
    it("lists all users with pagination", async () => {
      const req = makeRequest("/api/v1/users?limit=2");
      const res = await ListUsers(req);
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.data).toHaveLength(2);
      expect(body.data.pagination.total_count).toBe(3);
      expect(body.data.pagination.has_more).toBe(true);
    });

    it("non-root gets 403", async () => {
      mockCaller(CALLERS.user);
      const req = makeRequest("/api/v1/users");
      const res = await ListUsers(req);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/users/me", () => {
    it("returns current user info", async () => {
      const req = makeRequest("/api/v1/users/me");
      const res = await GetMe(req);
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.email).toBe("root@example.com");
      expect(body.data.role).toBe("root");
    });

    it("works for non-root user", async () => {
      mockCaller(CALLERS.user);
      const req = makeRequest("/api/v1/users/me");
      const res = await GetMe(req);
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.email).toBe("user@example.com");
    });
  });

  describe("PATCH /api/v1/users/:email", () => {
    it("updates user role", async () => {
      const req = makeJsonRequest("/api/v1/users/user@example.com", "PATCH", {
        role: "root",
      });
      const res = await UpdateUser(req, {
        params: Promise.resolve({ email: "user@example.com" }),
      });
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.updated_fields).toContain("role");

      const db = await getDb();
      const user = await db.collection("user").findOne({ email: "user@example.com" });
      expect(user!.role).toBe("root");
    });

    it("updates active status", async () => {
      const req = makeJsonRequest("/api/v1/users/user@example.com", "PATCH", {
        active: false,
      });
      const res = await UpdateUser(req, {
        params: Promise.resolve({ email: "user@example.com" }),
      });
      expect(res.status).toBe(200);
    });

    it("non-root gets 403", async () => {
      mockCaller(CALLERS.user);
      const req = makeJsonRequest("/api/v1/users/ann@example.com", "PATCH", {
        role: "root",
      });
      const res = await UpdateUser(req, {
        params: Promise.resolve({ email: "ann@example.com" }),
      });
      expect(res.status).toBe(403);
    });

    it("returns 404 for nonexistent user", async () => {
      const req = makeJsonRequest("/api/v1/users/nobody@example.com", "PATCH", {
        role: "user",
      });
      const res = await UpdateUser(req, {
        params: Promise.resolve({ email: "nobody@example.com" }),
      });
      expect(res.status).toBe(404);
    });

    it("rejects empty update", async () => {
      const req = makeJsonRequest("/api/v1/users/user@example.com", "PATCH", {});
      const res = await UpdateUser(req, {
        params: Promise.resolve({ email: "user@example.com" }),
      });
      expect(res.status).toBe(400);
    });
  });
});

describe("Presence", () => {
  beforeEach(() => {
    mockCaller(CALLERS.root);
  });

  it("returns empty when no params", async () => {
    const req = makeRequest("/api/v1/presence");
    const res = await GetPresence(req);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toEqual({});
  });

  it("returns active status for recent heartbeat", async () => {
    const db = await getDb();
    await db.collection("user_presence").insertOne({
      username: "ann@test.com",
      batch_id: "batch-001",
      last_heartbeat: new Date().toISOString(),
      status: "active",
    });

    const req = makeRequest("/api/v1/presence?usernames=ann@test.com");
    const res = await GetPresence(req);
    const body = await json(res);
    expect(body.data["ann@test.com"].status).toBe("active");
    expect(body.data["ann@test.com"].batch_id).toBe("batch-001");
  });

  it("returns away for old heartbeat", async () => {
    const db = await getDb();
    const old = new Date(Date.now() - 300_000).toISOString(); // 5 min ago
    await db.collection("user_presence").insertOne({
      username: "old@test.com",
      batch_id: "batch-001",
      last_heartbeat: old,
      status: "active",
    });

    const req = makeRequest("/api/v1/presence?usernames=old@test.com");
    const res = await GetPresence(req);
    const body = await json(res);
    expect(body.data["old@test.com"].status).toBe("away");
  });

  it("returns idle for heartbeat between 45s and 180s", async () => {
    const db = await getDb();
    const recent = new Date(Date.now() - 60_000).toISOString(); // 60s ago
    await db.collection("user_presence").insertOne({
      username: "idle@test.com",
      batch_id: "batch-001",
      last_heartbeat: recent,
      status: "active",
    });

    const req = makeRequest("/api/v1/presence?usernames=idle@test.com");
    const res = await GetPresence(req);
    const body = await json(res);
    expect(body.data["idle@test.com"].status).toBe("idle");
  });

  it("filters by batch_id", async () => {
    const db = await getDb();
    await db.collection("user_presence").insertMany([
      { username: "a@test.com", batch_id: "b1", last_heartbeat: new Date().toISOString(), status: "active" },
      { username: "b@test.com", batch_id: "b2", last_heartbeat: new Date().toISOString(), status: "active" },
    ]);

    const req = makeRequest("/api/v1/presence?batch_id=b1");
    const res = await GetPresence(req);
    const body = await json(res);
    expect(Object.keys(body.data)).toHaveLength(1);
    expect(body.data["a@test.com"]).toBeDefined();
  });
});
