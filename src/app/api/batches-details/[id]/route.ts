import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { sendTaskAssignmentEmail } from "@/lib/mailer";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const batch_id = (await params).id;
    const {
      annotator_id = null,
      sendEmail = false,
      assigneeEmail = null,
    } = await req.json();

    const client = await clientPromise;
    const db = client.db();

    // Update batch with annotator_id (can be null to revoke)
    const result = await db
      .collection("batches_details")
      .updateOne({ batch_id }, { $set: { annotator_id } });

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { message: "Batch detail not found" },
        { status: 404 }
      );
    }

    // Optional: Send assignment email only if annotator_id and email present
    if (sendEmail && annotator_id && assigneeEmail) {
      const normAssigneeEmail = assigneeEmail.trim().toLowerCase();

      const user = await db.collection("users").findOne({
        $or: [{ email: normAssigneeEmail }, { username: normAssigneeEmail }],
      });

      const batch = await db
        .collection("batches_details")
        .findOne({ batch_id });

      if (user && batch) {
        const batchName = batch.batch_name || "Unnamed Project";
        const taskName =
          `${batch?.source_language?.iso_name}-TO-${batch?.target_language?.iso_name}` ||
          `Batch ${batch_id}`;
        const assigneeName = user.fullName || user.username || "Annotator";

        await sendTaskAssignmentEmail({
          to: annotator_id,
          batchName,
          taskName,
          assigneeName,
        });
      }
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
