import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";
import session from "@/lib/session"; // In-memory session for prototyping

export async function POST(req: Request) {
  const body = await req.json();
  const username = body?.username?.trim().toLowerCase();
  const password = body?.password;

  if (!username || !password) {
    return NextResponse.json(
      { message: "Missing credentials" },
      { status: 400 }
    );
  }

  const client = await clientPromise;
  const db = client.db();
  const user = await db.collection("users").findOne({ username });

  const isValid = await bcrypt.compare(password, user?.password ?? "");
  if (!user || !isValid) {
    return NextResponse.json(
      {
        message:
          "The email address or password you entered is incorrect. Please check both and try again.",
      },
      { status: 404 }
    );
  }

  // ✅ Check if account is active
  if (!user.active) {
    return NextResponse.json(
      {
        message:
          "Your account is not yet confirmed. Please check your email to activate your account.",
      },
      { status: 403 }
    );
  }

  const role = user?.role?.trim().toLowerCase();

  // Store session in memory (for prototyping)
  session[username] = user;

  return NextResponse.json({ message: "Login successful", username, role });
}
