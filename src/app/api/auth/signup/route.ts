import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";
import { generateResetToken } from "@/lib/token";
import { sendResetEmail } from "@/lib/mailer";

export async function POST(req: Request) {
  const body = await req.json();
  const { password, fullName, institution, role } = body;
  const username = body?.username?.trim().toLowerCase();
  const email = body?.email?.trim().toLowerCase();

  if (!username || !password) {
    return NextResponse.json(
      { message: "Username and password are required" },
      { status: 400 }
    );
  }

  const client = await clientPromise;
  const db = client.db();

  const existingUser = await db.collection("users").findOne({ username });
  if (existingUser) {
    return NextResponse.json(
      { message: `User with ${email} already exists, please signin!` },
      { status: 409 }
    );
  }

  const tokenCollection = db.collection("user_tokens");

  // Invalidate any old user_tokens for this user by deleting them
  await tokenCollection.deleteMany({ email: email.toLowerCase() });

  const token = generateResetToken();
  const expirationTime = parseInt(
    process.env.CONFIRM_EMAIL_TOKEN_EXPIRATION ??
      `${15 * 365 * 24 * 60 * 60 * 1000}`
  ); // Token valid for 15 years
  const expires = new Date(Date.now() + expirationTime); // Token expires in expirationTime from now

  // Insert the new token into the database
  await tokenCollection.insertOne({
    email: email.toLowerCase(),
    token,
    expires,
  });

  const hashedPassword = await bcrypt.hash(password, 10);
  await db.collection("users").insertOne({
    username,
    password: hashedPassword,
    email,
    fullName,
    institution,
    role,
    createdAt: new Date(),
  });

  const route = "confirm-email";
  await sendResetEmail(route, email, token);

  return NextResponse.json({
    message: `We sent an email confirmation link to ${email}. Please check your INBOX/SPAM & confirm your email!`,
  });
}
