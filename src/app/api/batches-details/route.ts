export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { BatchDetailTypes } from "@/types/data";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const username = auth.username;

  try {
    const client = await getClientPromise();
    const db = client.db();

    const datasetType = req.nextUrl.searchParams
      .get("dataset_type")
      ?.toLowerCase();

    if (!datasetType) {
      return NextResponse.json(
        { message: "Bad request: 'dataset_type' is required." },
        { status: 400 }
      );
    }

    const role = auth.role;
    const baseQuery: { dataset_type: string; $or?: Array<Record<string, unknown>> } = {
      dataset_type: datasetType,
    };

    // 🔐 Apply filtering only if not root
    if (role !== "root") {
      baseQuery.$or = [
        { created_by: { $regex: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
        { annotator_id: { $regex: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
        { qa_id: { $regex: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } },
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
      { message: "Failed to fetch data", error: String(error) },
      { status: 500 }
    );
  }
}
