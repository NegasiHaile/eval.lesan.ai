import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { createHash } from "crypto";
import { makeRequest, getDb, makeUser } from "@/test/helpers";
import type { ApiCaller } from "@/lib/api-types";
import * as authMod from "@/lib/auth";

// The global test setup mocks @/lib/api-auth wholesale so the route tests can
// stub the caller. These tests instead exercise the REAL resolver against the
// in-memory Mongo, covering the API-key lifecycle, live owner lookup, and scope
// enforcement — none of which the route tests touch.
let resolveApiCaller: typeof import("@/lib/api-auth").resolveApiCaller;

beforeAll(async () => {
  const real = await vi.importActual<typeof import("@/lib/api-auth")>(
    "@/lib/api-auth"
  );
  resolveApiCaller = real.resolveApiCaller;
});

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function bearer(token: string) {
  return makeRequest("/api/v1/anything", {
    headers: { authorization: `Bearer ${token}` },
  });
}

const TOKEN = "heval_" + "a".repeat(40);

async function seedKey(
  overrides: Partial<{
    token: string;
    owner_email: string;
    role: string;
    scopes: string[];
    expires_at: string | null;
    active: boolean;
  }> = {}
): Promise<string> {
  const token = overrides.token ?? TOKEN;
  const db = await getDb();
  await db.collection("api_keys").insertOne({
    key_hash: hashKey(token),
    key_prefix: token.slice(0, 10) + "...",
    owner_email: overrides.owner_email ?? "owner@example.com",
    name: "test key",
    role: overrides.role ?? "user", // snapshot at creation — must NOT be trusted
    scopes: overrides.scopes ?? ["*"],
    created_at: new Date().toISOString(),
    last_used_at: null,
    expires_at: overrides.expires_at ?? null,
    active: overrides.active ?? true,
  });
  return token;
}

async function seedOwner(
  overrides: Partial<{ email: string; role: string; active: boolean }> = {}
) {
  const db = await getDb();
  await db
    .collection("user")
    .insertOne(makeUser({ email: "owner@example.com", ...overrides }));
}

describe("resolveApiCaller (real)", () => {
  beforeEach(() => {
    // Default: no session, so the API-key path is the only one exercised.
    vi.mocked(authMod.getSessionFromRequest).mockResolvedValue(null);
  });

  it("resolves a valid key for an active owner", async () => {
    await seedOwner();
    const token = await seedKey();

    const caller = await resolveApiCaller(bearer(token));

    expect(caller).not.toBeInstanceOf(Response);
    const c = caller as ApiCaller;
    expect(c.username).toBe("owner@example.com");
    expect(c.source).toBe("api_key");
    expect(c.scopes).toEqual(["*"]);
  });

  it("uses the owner's CURRENT role, not the role snapshotted on the key", async () => {
    await seedOwner({ role: "root" }); // owner has since been promoted
    const token = await seedKey({ role: "user" }); // key still says 'user'

    const caller = (await resolveApiCaller(bearer(token))) as ApiCaller;

    expect(caller.role).toBe("root");
  });

  it("rejects a key whose owner is deactivated", async () => {
    await seedOwner({ active: false });
    const token = await seedKey();

    const res = await resolveApiCaller(bearer(token));

    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
  });

  it("rejects a key whose owner no longer exists", async () => {
    const token = await seedKey(); // no user seeded

    const res = await resolveApiCaller(bearer(token));

    expect((res as Response).status).toBe(401);
  });

  it("rejects a revoked key", async () => {
    await seedOwner();
    const token = await seedKey({ active: false });

    const res = await resolveApiCaller(bearer(token));

    expect((res as Response).status).toBe(401);
  });

  it("rejects an expired key", async () => {
    await seedOwner();
    const token = await seedKey({ expires_at: "2000-01-01T00:00:00Z" });

    const res = await resolveApiCaller(bearer(token));

    expect((res as Response).status).toBe(401);
  });

  it("rejects an unknown key", async () => {
    await seedOwner();
    await seedKey();

    const res = await resolveApiCaller(bearer("heval_" + "f".repeat(40)));

    expect((res as Response).status).toBe(401);
  });

  it("stamps last_used_at on use", async () => {
    await seedOwner();
    const token = await seedKey();

    await resolveApiCaller(bearer(token));
    // last_used_at is fire-and-forget; let the microtask settle.
    await new Promise((r) => setTimeout(r, 10));

    const db = await getDb();
    const record = await db
      .collection("api_keys")
      .findOne({ key_hash: hashKey(token) });
    expect(record!.last_used_at).toBeTruthy();
  });

  describe("scope enforcement", () => {
    it("denies a key that lacks the required scope", async () => {
      await seedOwner();
      const token = await seedKey({ scopes: ["batches:read"] });

      const res = await resolveApiCaller(bearer(token), "batches:write");

      expect(res).toBeInstanceOf(Response);
      expect((res as Response).status).toBe(403);
    });

    it("allows a key that carries the required scope", async () => {
      await seedOwner();
      const token = await seedKey({ scopes: ["batches:read"] });

      const caller = await resolveApiCaller(bearer(token), "batches:read");

      expect(caller).not.toBeInstanceOf(Response);
    });

    it("treats the '*' wildcard as every scope", async () => {
      await seedOwner();
      const token = await seedKey({ scopes: ["*"] });

      const caller = await resolveApiCaller(bearer(token), "users:write");

      expect(caller).not.toBeInstanceOf(Response);
    });
  });

  describe("session fallback", () => {
    it("resolves a session caller and bypasses scope checks", async () => {
      vi.mocked(authMod.getSessionFromRequest).mockResolvedValue({
        username: "sess@example.com",
        role: "user",
      });

      const caller = (await resolveApiCaller(
        makeRequest("/api/v1/anything"),
        "batches:write"
      )) as ApiCaller;

      expect(caller.source).toBe("session");
      expect(caller.username).toBe("sess@example.com");
    });

    it("returns 401 when neither a key nor a session is present", async () => {
      const res = await resolveApiCaller(makeRequest("/api/v1/anything"));

      expect((res as Response).status).toBe(401);
    });
  });
});
