// src/app/api/user/[email]/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";

function canAccess(sessionUsername: string, sessionRole: string, targetEmail: string): boolean {
  const role = sessionRole.toLowerCase();
  const isAdmin = role === "root" || role === "admin";
  const isSelf = sessionUsername.toLowerCase() === targetEmail.toLowerCase();
  return isAdmin || isSelf;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const email = (await params).email;
  if (!canAccess(auth.username, auth.role, email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const user = await db.collection("users").findOne(
      { $or: [{ email }, { username: email }] },
      { projection: { password: 0 } }
    );
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
