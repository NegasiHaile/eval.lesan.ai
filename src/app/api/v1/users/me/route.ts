export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/api-errors";

/** GET /api/v1/users/me — Current authenticated user info. */
export async function GET(req: NextRequest) {
  const caller = await resolveApiCaller(req);
  if (caller instanceof Response) return caller;

  const client = await getClientPromise();
  const db = client.db();

  const user = await db.collection("user").findOne({ email: caller.username });

  return apiSuccess({
    email: caller.username,
    full_name: user?.name ?? null,
    role: caller.role,
  });
}
