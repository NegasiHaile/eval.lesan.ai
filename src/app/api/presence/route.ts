import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import getClientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";

let indexCreated = false;

async function ensureIndex() {
  if (indexCreated) return;
  const client = await getClientPromise();
  const col = client.db().collection("user_presence");
  await Promise.all([
    col.createIndex(
      { last_heartbeat: 1 },
      { expireAfterSeconds: 300, background: true }
    ),
    col.createIndex({ username: 1 }, { unique: true, background: true }),
  ]);
  indexCreated = true;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { status, batch_id } = await req.json();

  await ensureIndex();

  const client = await getClientPromise();
  const col = client.db().collection("user_presence");

  await col.updateOne(
    { username: auth.username },
    {
      $set: {
        username: auth.username,
        status: status === "active" ? "active" : "idle",
        batch_id: batch_id ?? null,
        last_heartbeat: new Date(),
      },
    },
    { upsert: true }
  );

  return new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const fromRepeated = req.nextUrl.searchParams.getAll("username");
  const fromCsv = (req.nextUrl.searchParams.get("usernames") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const requestedUsernames = [...new Set([...fromRepeated, ...fromCsv])].slice(
    0,
    100
  );
  if (requestedUsernames.length === 0) {
    return NextResponse.json({});
  }

  const role = auth.role.toLowerCase();
  let usernames = requestedUsernames;

  if (!["root", "admin"].includes(role)) {
    const escaped = auth.username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^${escaped}$`, "i");

    const client = await getClientPromise();
    const db = client.db();
    const visibleBatches = await db
      .collection("batches_details")
      .find(
        {
          $or: [
            { created_by: { $regex: pattern } },
            { annotator_id: { $regex: pattern } },
            { qa_id: { $regex: pattern } },
          ],
        },
        {
          projection: { created_by: 1, annotator_id: 1, qa_id: 1 },
        }
      )
      .toArray();

    const allowed = new Set<string>([auth.username.toLowerCase()]);
    for (const b of visibleBatches) {
      for (const raw of [b.created_by, b.annotator_id, b.qa_id]) {
        if (typeof raw === "string" && raw.trim()) {
          allowed.add(raw.toLowerCase());
        }
      }
    }

    usernames = requestedUsernames.filter((u) => allowed.has(u.toLowerCase()));
    if (usernames.length === 0) {
      return NextResponse.json({});
    }
  }

  const client = await getClientPromise();
  const col = client.db().collection("user_presence");
  const docs = await col.find({ username: { $in: usernames } }).toArray();
  const byUsername = new Map<string, Record<string, unknown>>();
  for (const d of docs) {
    const key = String(d.username ?? "");
    if (key) byUsername.set(key, d as Record<string, unknown>);
  }

  const now = Date.now();
  const result: Record<string, { status: "active" | "idle" | "away"; batch_id: string | null }> = {};

  for (const u of usernames) {
    const doc = byUsername.get(u);
    if (!doc) {
      result[u] = { status: "away", batch_id: null };
      continue;
    }
    const lastHeartbeatRaw = doc.last_heartbeat;
    const lastHeartbeat = new Date(String(lastHeartbeatRaw)).getTime();
    const elapsed = Number.isFinite(lastHeartbeat) ? now - lastHeartbeat : Number.MAX_SAFE_INTEGER;
    const currentStatus = String(doc.status ?? "");
    let status: "active" | "idle" | "away";
    if (elapsed < 45_000 && currentStatus === "active") {
      status = "active";
    } else if (elapsed < 180_000) {
      status = "idle";
    } else {
      status = "away";
    }
    result[u] = { status, batch_id: (doc.batch_id as string | null | undefined) ?? null };
  }

  return NextResponse.json(result);
}
