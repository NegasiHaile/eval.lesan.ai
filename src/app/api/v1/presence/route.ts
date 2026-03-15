export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/api-errors";

/** GET /api/v1/presence — Query annotator presence. */
export async function GET(req: NextRequest) {
  const caller = await resolveApiCaller(req);
  if (caller instanceof Response) return caller;

  const usernamesParam = req.nextUrl.searchParams.get("usernames");
  const batchIdParam = req.nextUrl.searchParams.get("batch_id");

  if (!usernamesParam && !batchIdParam) {
    return apiSuccess({});
  }

  const client = await getClientPromise();
  const db = client.db();
  const col = db.collection("user_presence");

  const query: Record<string, unknown> = {};
  if (usernamesParam) {
    const usernames = usernamesParam.split(",").filter(Boolean).slice(0, 100);
    if (usernames.length > 0) {
      query.username = { $in: usernames };
    }
  }
  if (batchIdParam) {
    query.batch_id = batchIdParam;
  }

  const docs = await col.find(query).toArray();

  const now = Date.now();
  const result: Record<string, { status: "active" | "idle" | "away"; batch_id: string | null }> = {};

  for (const doc of docs) {
    const elapsed = now - new Date(doc.last_heartbeat).getTime();
    let status: "active" | "idle" | "away";
    if (elapsed < 45_000 && doc.status === "active") {
      status = "active";
    } else if (elapsed < 180_000) {
      status = "idle";
    } else {
      status = "away";
    }
    result[doc.username] = { status, batch_id: doc.batch_id ?? null };
  }

  return apiSuccess(result);
}
