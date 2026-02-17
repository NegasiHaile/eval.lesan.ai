import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb"; // Use your existing client promise

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { valid: false, message: "Token not provided." },
      { status: 400 }
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const tokenCollection = db.collection("user_tokens");

    // Find a token that matches AND has an expiration date in the future.
    // The `$gt` operator means "greater than".
    const tokenDoc = await tokenCollection.findOne({
      token: token,
      expires: { $gt: new Date() },
    });

    // If no document is found, the token is either invalid or expired.
    if (!tokenDoc) {
      return NextResponse.json(
        { valid: false, message: "Token is invalid or has expired." },
        { status: 400 }
      );
    }

    // The token is valid.
    return NextResponse.json({ valid: true, email: tokenDoc.email });
  } catch (error) {
    console.error("Verify token error:", error);
    return NextResponse.json(
      { message: "An internal server error occurred." },
      { status: 500 }
    );
  }
}
