/** Standardized error/success response helpers for /api/v1/ endpoints. */

import { NextResponse } from "next/server";

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown[]
): NextResponse {
  const body: { error: { code: string; message: string; details?: unknown[] } } = {
    error: { code, message },
  };
  if (details) body.error.details = details;
  return NextResponse.json(body, { status });
}

// Common error codes
export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  CONFLICT: "CONFLICT",
  RATE_RANK_INCONSISTENT: "RATE_RANK_INCONSISTENT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
