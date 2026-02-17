import { NextRequest, NextResponse } from "next/server";
import { generateResetToken } from "@/lib/token";
import { sendResetEmail } from "@/lib/mailer";
import clientPromise from "@/lib/mongodb"; // Use your existing client promise

export async function POST(req: NextRequest) {
  let { email } = await req.json();
  email = email.trim();

  if (!email) {
    return NextResponse.json({ message: "Email is required" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();

    // Check if a user with this email exists before proceeding
    const user = await db
      .collection("users")
      .findOne({ username: email.toLowerCase() });

    if (!user) {
      // IMPORTANT: Don't reveal that the user doesn't exist.
      // This prevents "email enumeration" attacks.
      return NextResponse.json({
        message: `If an account with ${email} email exists, a reset link has been sent. Please sign in to your email and follow the instructions there.`,
      });
    }

    const tokenCollection = db.collection("user_tokens");

    // Invalidate any old user_tokens for this user by deleting them
    await tokenCollection.deleteMany({ email: email.toLowerCase() });

    const token = generateResetToken();
    const expirationTime = parseInt(
      process.env.FORGET_PASSWORD_TOKEN_EXPIRATION ?? `${30 * 60 * 1000}`
    ); // Token valid for 30 minutes
    const expires = new Date(Date.now() + expirationTime); // Token expires in expirationTime from now

    // Insert the new token into the database
    await tokenCollection.insertOne({
      email: email.toLowerCase(),
      token,
      expires,
    });

    // const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password?token=${token}`;

    const route = "reset-password";
    await sendResetEmail(route, email, token);

    return NextResponse.json({
      message: `If an account with ${email} email exists, a reset link should be in your INBOX or SPAM folder.`,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { message: "An internal server error occurred." },
      { status: 500 }
    );
  }
}
