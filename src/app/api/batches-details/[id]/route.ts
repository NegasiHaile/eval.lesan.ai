export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  try {
    const batch_id = (await params).id;
    const body = await req.json();
    const annotator_id = body.annotator_id !== undefined ? body.annotator_id : undefined;
    const created_by = typeof body.created_by === "string" ? body.created_by.trim() || null : undefined;

    const client = await getClientPromise();
    const db = client.db();

    const batch = await db.collection("batches_details").findOne({ batch_id });
    if (!batch) {
      return NextResponse.json(
        { message: "Batch detail not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (created_by !== undefined) {
      if (auth.role.toLowerCase() !== "root") {
        return NextResponse.json(
          { message: "Forbidden. Only root can update the batch creator." },
          { status: 403 }
        );
      }
      updates.created_by = created_by ?? batch.created_by;
    }

    if (annotator_id !== undefined) {
      const isAdminOrRoot = ["root", "admin"].includes(auth.role.toLowerCase());
      const isCreator = batch.created_by?.toLowerCase() === auth.username.toLowerCase();
      const isAssignedAnnotator = batch.annotator_id?.toLowerCase() === auth.username.toLowerCase();
      if (!isAdminOrRoot && !isCreator && !isAssignedAnnotator) {
        return NextResponse.json(
          { message: "Forbidden. Only the batch creator, assigned annotator, or an admin can assign annotators." },
          { status: 403 }
        );
      }
      updates.annotator_id = annotator_id;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { message: "No valid fields to update (annotator_id or created_by)." },
        { status: 400 }
      );
    }

    const result = await db
      .collection("batches_details")
      .updateOne({ batch_id }, { $set: updates });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { message: "Batch detail not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Batch detail updated successfully" });
  } catch (error) {
    console.error("PATCH /batches/[id] error:", error);
    return NextResponse.json(
      { message: "Failed to update batch detail", error: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
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

    const client = await getClientPromise();
    const db = client.db();

    const existing = await db.collection("batches_details").findOne({ batch_id });
    if (!existing) {
      return NextResponse.json(
        { message: "Batch detail not found" },
        { status: 404 }
      );
    }

    const isAdminOrRoot = ["root", "admin"].includes(auth.role.toLowerCase());
    const isCreator = existing.created_by?.toLowerCase() === auth.username.toLowerCase();
    const isAssignedAnnotator = existing.annotator_id?.toLowerCase() === auth.username.toLowerCase();
    if (!isAdminOrRoot && !isCreator && !isAssignedAnnotator) {
      return NextResponse.json(
        { message: "Forbidden. Only the batch creator, assigned annotator, or an admin can update this batch." },
        { status: 403 }
      );
    }

    // Annotators may only update annotated_tasks
    if (!isAdminOrRoot && !isCreator) {
      const result = await db
        .collection("batches_details")
        .updateOne({ batch_id }, { $set: { annotated_tasks: updatedBatch.annotated_tasks } });
      return NextResponse.json({
        message: "Batch detail updated successfully",
        modifiedCount: result.modifiedCount,
      });
    }

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
      { message: "Failed to update batch", error: String(error) },
      { status: 500 }
    );
  }
}
