import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { BatchDetailTypes } from "@/types/data";

export async function GET(req: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db();

    const username = req.nextUrl.searchParams.get("username")?.toLowerCase();
    const datasetType = req.nextUrl.searchParams
      .get("dataset_type")
      ?.toLowerCase();

    if (!username) {
      return NextResponse.json(
        { message: "Unauthorized: username is required." },
        { status: 400 }
      );
    }

    if (!datasetType) {
      return NextResponse.json(
        { message: "Bad request: 'dataset_type' is required." },
        { status: 400 }
      );
    }

    // 🔍 Fetch user's role from the `users` collection
    const user = await db.collection("users").findOne({ username });

    if (!user) {
      return NextResponse.json(
        { message: `User '${username}' not found.` },
        { status: 404 }
      );
    }

    const role = user.role?.toLowerCase();
    const baseQuery: any = {
      dataset_type: datasetType,
    };

    // 🔐 Apply filtering only if not root
    if (role !== "root") {
      baseQuery.$or = [
        { created_by: { $regex: new RegExp(`^${username}$`, "i") } },
        { annotator_id: { $regex: new RegExp(`^${username}$`, "i") } },
        { qa_id: { $regex: new RegExp(`^${username}$`, "i") } },
      ];
    }

    const batchDetails = await db
      .collection<BatchDetailTypes>("batches_details")
      .find(baseQuery)
      .toArray();

    return NextResponse.json([...batchDetails].reverse());
  } catch (error) {
    console.error("Error fetching batch details:", error);
    return NextResponse.json(
      { message: "Failed to fetch data", error },
      { status: 500 }
    );
  }
}
