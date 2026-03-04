export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ datasetType: string; batchId: string; taskId: string }>;
  }
) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const client = await getClientPromise();
  const db = client.db();
  const { datasetType, batchId, taskId } = await params;

  const updatedTask = await req.json(); // The updated task object

  try {
    // Check if the caller is the batch's reviewer (qa_id)
    const batchDetail = await db.collection("batches_details").findOne({ batch_id: batchId });
    const isReviewer =
      batchDetail?.qa_id &&
      batchDetail.qa_id.toLowerCase() === auth.username.toLowerCase();
    const isAdminOrRoot = ["root", "admin"].includes(auth.role.toLowerCase());
    const isCreator = batchDetail?.created_by?.toLowerCase() === auth.username.toLowerCase();
    const isAnnotator = batchDetail?.annotator_id?.toLowerCase() === auth.username.toLowerCase();

    // If the caller is the reviewer (and not also creator/annotator/admin), only allow reviewer_comment updates
    if (isReviewer && !isAdminOrRoot && !isCreator && !isAnnotator) {
      // Fetch the existing task first
      const existingBatch = await db.collection(`${datasetType}_batches`).findOne(
        {
          batch_id: batchId,
          $or: [{ "tasks.id": Number(taskId) }, { "tasks.id": String(taskId) }],
        },
        { projection: { "tasks.$": 1 } }
      );
      const existingTask = existingBatch?.tasks?.[0];
      if (!existingTask) {
        return NextResponse.json({ message: "Task not found" }, { status: 404 });
      }
      // Only update reviewer_comment, keep everything else from the existing task
      const reviewerOnlyTask = { ...existingTask, reviewer_comment: updatedTask.reviewer_comment ?? "" };
      const reviewResult = await db.collection(`${datasetType}_batches`).updateOne(
        {
          batch_id: batchId,
          $or: [{ "tasks.id": Number(taskId) }, { "tasks.id": String(taskId) }],
        },
        { $set: { "tasks.$": reviewerOnlyTask } }
      );
      if (reviewResult.modifiedCount === 0) {
        return NextResponse.json({ message: "Task not found or not updated" }, { status: 404 });
      }
      return NextResponse.json({ message: "Reviewer comment updated successfully" });
    }

    const result = await db.collection(`${datasetType}_batches`).updateOne(
      {
        batch_id: batchId,
        $or: [
          { "tasks.id": Number(taskId) },
          {
            "tasks.id": String(taskId),
          },
        ],
      },
      {
        $set: {
          "tasks.$": updatedTask,
        },
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { message: "Task not found or not updated" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Task updated successfully" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Failed to update task", error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ datasetType: string; batchId: string; taskId: string }>;
  }
) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const client = await getClientPromise();
  const db = client.db();

  const { datasetType, batchId, taskId } = await params;

  try {
    // Fetch the batch containing the task
    const task = await db.collection(`${datasetType}_batches`).findOne(
      {
        batch_id: batchId,
        "tasks.id": String(taskId),
      },
      {
        projection: {
          tasks: {
            $filter: {
              input: "$tasks",
              as: "task",
              cond: { $eq: ["$$task.id", String(taskId)] },
            },
          },
          _id: 0,
        },
      }
    );

    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task?.tasks[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Failed to fetch task", error: String(error) },
      { status: 500 }
    );
  }
}
