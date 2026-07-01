/**
 * Dual auth resolver for /api/v1/ endpoints.
 * Checks API key (Authorization: Bearer heval_...) first, falls back to session.
 */

import { createHash } from "crypto";
import getClientPromise from "@/lib/mongodb";
import { getSessionFromRequest } from "@/lib/auth";
import { apiError, ErrorCodes } from "@/lib/api-errors";
import type { ApiCaller, ApiKeyRecord } from "@/lib/api-types";

const API_KEY_PREFIX = "heval_";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Resolve the caller from the request.
 * Returns an ApiCaller on success, or a NextResponse (error) on failure.
 *
 * When `requiredScope` is provided, API-key callers must carry that scope
 * (or "*"); session callers always pass. This is how per-route scope
 * enforcement is wired in — pass the scope the endpoint needs.
 */
export async function resolveApiCaller(
  req: Request,
  requiredScope?: string
): Promise<ApiCaller | Response> {
  const caller = await resolveCaller(req);
  if (caller instanceof Response) return caller;

  if (requiredScope) {
    const scopeError = requireApiScope(caller, requiredScope);
    if (scopeError) return scopeError;
  }

  return caller;
}

async function resolveCaller(req: Request): Promise<ApiCaller | Response> {
  const authHeader = req.headers.get("authorization");

  // Try API key auth
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith(API_KEY_PREFIX)) {
      return resolveFromApiKey(token);
    }
  }

  // Fall back to session auth
  const session = await getSessionFromRequest(req);
  if (!session) {
    return apiError(
      ErrorCodes.UNAUTHORIZED,
      "Authentication required. Provide a valid API key or session.",
      401
    );
  }

  return {
    username: session.username,
    role: session.role,
    source: "session",
  };
}

async function resolveFromApiKey(token: string): Promise<ApiCaller | Response> {
  const hash = hashKey(token);

  const client = await getClientPromise();
  const db = client.db();
  const record = await db
    .collection<ApiKeyRecord>("api_keys")
    .findOne({ key_hash: hash });

  if (!record || !record.active) {
    return apiError(
      ErrorCodes.UNAUTHORIZED,
      "Invalid or revoked API key.",
      401
    );
  }

  // Check expiration
  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return apiError(
      ErrorCodes.UNAUTHORIZED,
      "API key has expired.",
      401
    );
  }

  // Resolve the owner's *current* state — never trust the role snapshotted at
  // key-creation time. A demoted or deactivated owner must lose access
  // immediately, even through pre-existing keys.
  const owner = await db.collection("user").findOne({ email: record.owner_email });
  if (!owner || owner.active === false) {
    return apiError(
      ErrorCodes.UNAUTHORIZED,
      "API key owner is inactive or no longer exists.",
      401
    );
  }

  // Update last_used_at (fire and forget)
  db.collection("api_keys")
    .updateOne({ key_hash: hash }, { $set: { last_used_at: new Date().toISOString() } })
    .catch(() => {});

  return {
    username: record.owner_email,
    role: (owner.role as string) ?? "user",
    source: "api_key",
    scopes: record.scopes,
  };
}

/**
 * Check if an API key caller has the required scope.
 * Returns null if allowed, or a Response (403) if denied.
 * Session callers always pass scope checks.
 */
export function requireApiScope(
  caller: ApiCaller,
  scope: string
): Response | null {
  if (caller.source === "session") return null;
  if (caller.scopes && caller.scopes.includes(scope)) return null;
  if (caller.scopes && caller.scopes.includes("*")) return null;

  return apiError(
    ErrorCodes.FORBIDDEN,
    `API key missing required scope: ${scope}`,
    403
  );
}
