import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    // 1. Validate input
    if (!token || !password) {
      return NextResponse.json(
        { message: "Token and password are required" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { message: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();
    const tokenCollection = db.collection("user_tokens");

    // 2. Verify the token is valid and not expired
    const tokenDoc = await tokenCollection.findOne({
      token: token,
      expires: { $gt: new Date() }, // Check if 'expires' is in the future
    });

    if (!tokenDoc) {
      return NextResponse.json(
        { message: "Invalid or expired token" },
        { status: 400 }
      );
    }

    // 3. Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Update the user's password in the 'users' collection
    // We find the user by the email stored in the token document.
    const usersCollection = db.collection("users");
    const updateResult = await usersCollection.updateOne(
      { username: tokenDoc.email },
      { $set: { password: hashedPassword } }
    );

    // Check if a user was actually found and updated
    if (updateResult.modifiedCount === 0) {
      // This is a safety check. It might happen if the user was deleted
      // after requesting the reset.
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    // 5. Invalidate the token by deleting it so it can't be used again
    await tokenCollection.deleteOne({ token: token });

    return NextResponse.json({
      message: "Password has been reset successfully.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { message: "An internal server error occurred." },
      { status: 500 }
    );
  }
}
