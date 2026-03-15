export const dynamic = "force-dynamic";

import { randomBytes, createHash } from "crypto";
import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-errors";
import type { ApiKeyRecord, ApiKeyCreateResponse } from "@/lib/api-types";

const API_KEY_PREFIX = "heval_";

function generateApiKey(): string {
  return API_KEY_PREFIX + randomBytes(20).toString("hex");
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** POST — Create a new API key. Session auth only. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body: { name?: string; scopes?: string[]; expires_in_days?: number };
  try {
    body = await req.json();
  } catch {
    return apiError(ErrorCodes.VALIDATION_FAILED, "Invalid JSON body.", 400);
  }

  const name = body.name?.trim();
  if (!name) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "Key name is required.", 400);
  }

  const scopes = body.scopes ?? ["*"];
  const plainKey = generateApiKey();
  const keyHash = hashKey(plainKey);
  const keyPrefix = plainKey.slice(0, 10) + "...";
  const now = new Date().toISOString();

  let expiresAt: string | null = null;
  if (body.expires_in_days && body.expires_in_days > 0) {
    const d = new Date();
    d.setDate(d.getDate() + body.expires_in_days);
    expiresAt = d.toISOString();
  }

  const record: ApiKeyRecord = {
    key_hash: keyHash,
    key_prefix: keyPrefix,
    owner_email: auth.username,
    name,
    role: auth.role,
    scopes,
    created_at: now,
    last_used_at: null,
    expires_at: expiresAt,
    active: true,
  };

  const client = await getClientPromise();
  const db = client.db();
  await db.collection("api_keys").insertOne(record);

  const response: ApiKeyCreateResponse = {
    key: plainKey,
    key_prefix: keyPrefix,
    name,
    scopes,
    created_at: now,
    expires_at: expiresAt,
  };

  return apiSuccess(response, 201);
}

/** GET — List own API keys (never returns full key). */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const client = await getClientPromise();
  const db = client.db();

  const keys = await db
    .collection<ApiKeyRecord>("api_keys")
    .find({ owner_email: auth.username, active: true })
    .project({
      key_hash: 0,
    })
    .sort({ created_at: -1 })
    .toArray();

  const result = keys.map((k) => ({
    id: k._id?.toString(),
    key_prefix: k.key_prefix,
    name: k.name,
    scopes: k.scopes,
    created_at: k.created_at,
    last_used_at: k.last_used_at,
    expires_at: k.expires_at,
  }));

  return apiSuccess(result);
}
