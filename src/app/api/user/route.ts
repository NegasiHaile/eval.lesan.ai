// src/app/api/user/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";

const ADMIN_ROLES = ["root", "admin"];
const BETTER_AUTH_USER_COLLECTION = "user";

function toAppUser(doc: { _id?: unknown; email: string; name?: string; role?: string; active?: boolean }) {
  return {
    username: doc.email,
    email: doc.email,
    fullName: doc.name ?? "",
    role: doc.role ?? "user",
    active: doc.active ?? true,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ADMIN_ROLES);
  if (auth instanceof Response) return auth;
  try {
    const client = await clientPromise;
    const db = client.db();
    const docs = await db
      .collection(BETTER_AUTH_USER_COLLECTION)
      .find({})
      .toArray();
    const users = docs.map((d) => toAppUser(d as Parameters<typeof toAppUser>[0]));
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, ADMIN_ROLES);
  if (auth instanceof Response) return auth;
  try {
    const client = await clientPromise;
    const db = client.db();

    const body = await request.json();
    const username = body?.username; // email in Better Auth

    if (!username) {
      return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }

    const userColl = db.collection(BETTER_AUTH_USER_COLLECTION);
    const user = await userColl.findOne({ email: username });
    if (!user) {
      return NextResponse.json({ deletedCount: 0 });
    }

    const userId = (user as { _id?: unknown })._id?.toString?.() ?? (user as { id?: string }).id;
    if (userId) {
      await db.collection("session").deleteMany({ userId });
      await db.collection("account").deleteMany({ userId });
    }
    const result = await userColl.deleteOne({ email: username });

    return NextResponse.json({ deletedCount: result.deletedCount });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ADMIN_ROLES);
  if (auth instanceof Response) return auth;
  try {
    const client = await clientPromise;
    const db = client.db();

    const body = await request.json();
    const { username, ...updates } = body;

    if (!username) {
      return NextResponse.json({ error: "Missing username" }, { status: 400 });
    }

    const allowed = new Set(["role", "active"]);
    const set: Record<string, unknown> = {};
    if (updates.role !== undefined && allowed.has("role")) set.role = updates.role;
    if (updates.active !== undefined && allowed.has("active")) set.active = updates.active;
    if (Object.keys(set).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const result = await db
      .collection(BETTER_AUTH_USER_COLLECTION)
      .updateOne({ email: username }, { $set: set });

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "User updated successfully" });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
