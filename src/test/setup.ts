/**
 * Global test setup: in-memory MongoDB + module mocks for auth/webhooks.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { vi, beforeAll, afterAll, afterEach } from "vitest";

let mongod: MongoMemoryServer;
let client: MongoClient;

// Mock mongodb module — resolves to in-memory server
vi.mock("@/lib/mongodb", () => ({
  default: () => Promise.resolve(client),
}));

// Mock api-webhooks — no-op
vi.mock("@/lib/api-webhooks", () => ({
  emitWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock auth module for api-keys routes (which use requireAuth directly)
vi.mock("@/lib/auth", () => ({
  getAuth: vi.fn(),
  getSessionFromRequest: vi.fn().mockResolvedValue(null),
  requireAuth: vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ message: "Unauthorized. Please sign in." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  ),
  requireRole: vi.fn(),
}));

// Mock api-auth module — default: unauthenticated
vi.mock("@/lib/api-auth", () => ({
  resolveApiCaller: vi.fn().mockResolvedValue(
    (() => {
      const { NextResponse } = require("next/server");
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    })()
  ),
  requireApiScope: vi.fn().mockReturnValue(null),
}));

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  client = new MongoClient(uri);
  await client.connect();

  // Patch db() to default to "test" database (mirror production patching)
  const originalDb = client.db.bind(client);
  client.db = (name?: string) => originalDb(name || "test");
});

afterEach(async () => {
  // Clean all collections between tests
  const db = client.db();
  const collections = await db.listCollections().toArray();
  await Promise.all(
    collections.map((c) => db.collection(c.name).deleteMany({}))
  );
});

afterAll(async () => {
  await client.close();
  await mongod.stop();
});
