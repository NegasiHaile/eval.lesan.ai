export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess, apiError, ErrorCodes } from "@/lib/api-errors";

/** GET /api/v1/users — List all users (root only). */
export async function GET(req: NextRequest) {
  const caller = await resolveApiCaller(req);
  if (caller instanceof Response) return caller;

  if (caller.role.toLowerCase() !== "root") {
    return apiError(ErrorCodes.FORBIDDEN, "Only root users can list all users.", 403);
  }

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "50", 10) || 50, 1), 100);
  const cursorParam = sp.get("cursor");
  const cursorIndex = cursorParam ? parseInt(cursorParam, 10) : 0;

  const client = await getClientPromise();
  const db = client.db();

  const totalCount = await db.collection("user").countDocuments();
  const users = await db
    .collection("user")
    .find()
    .sort({ createdAt: -1 })
    .skip(cursorIndex)
    .limit(limit + 1)
    .toArray();

  const hasMore = users.length > limit;
  const page = users.slice(0, limit);

  const data = page.map((u) => ({
    email: u.email,
    full_name: u.name ?? null,
    role: u.role ?? "user",
    active: u.active ?? true,
  }));

  const nextIndex = cursorIndex + limit;

  return apiSuccess({
    data,
    pagination: {
      next_cursor: hasMore ? String(nextIndex) : null,
      has_more: hasMore,
      total_count: totalCount,
    },
  });
}
