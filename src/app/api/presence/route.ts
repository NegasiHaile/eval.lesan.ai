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

  const usernamesParam = req.nextUrl.searchParams.get("usernames");
  if (!usernamesParam) {
    return NextResponse.json({});
  }

  const usernames = usernamesParam.split(",").filter(Boolean).slice(0, 100);
  if (usernames.length === 0) {
    return NextResponse.json({});
  }

  const client = await getClientPromise();
  const col = client.db().collection("user_presence");
  const docs = await col.find({ username: { $in: usernames } }).toArray();

  const now = Date.now();
  const result: Record<string, "active" | "idle" | "away"> = {};

  for (const u of usernames) {
    const doc = docs.find((d) => d.username === u);
    if (!doc) {
      result[u] = "away";
      continue;
    }
    const elapsed = now - new Date(doc.last_heartbeat).getTime();
    if (elapsed < 45_000 && doc.status === "active") {
      result[u] = "active";
    } else if (elapsed < 180_000) {
      result[u] = "idle";
    } else {
      result[u] = "away";
    }
  }

  return NextResponse.json(result);
}
