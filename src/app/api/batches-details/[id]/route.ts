import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { requireRole } from "@/lib/auth";

const ADMIN_ROLES = ["root", "admin"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ADMIN_ROLES);
  if (auth instanceof Response) return auth;
  try {
    const batch_id = (await params).id;
    const { annotator_id = null } = await req.json();

    const client = await clientPromise;
    const db = client.db();

    const result = await db
      .collection("batches_details")
      .updateOne({ batch_id }, { $set: { annotator_id } });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { message: "Batch detail not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "annotator_id updated successfully" });
  } catch (error) {
    console.error("PATCH /batches/[id] error:", error);
    return NextResponse.json(
      { message: "Failed to update annotator_id", error },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, ADMIN_ROLES);
  if (auth instanceof Response) return auth;
  try {
    const batch_id = (await params).id;
    const updatedBatch = await req.json();
    delete updatedBatch._id;

    if (!updatedBatch || Object.keys(updatedBatch).length === 0) {
      return NextResponse.json(
        { message: "No batch data provided" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    const result = await db
      .collection("batches_details")
      .updateOne({ batch_id }, { $set: updatedBatch });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { message: "Batch detail not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Batch detail updated successfully",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Failed to update batch", error },
      { status: 500 }
    );
  }
}
