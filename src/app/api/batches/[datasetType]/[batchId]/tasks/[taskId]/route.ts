import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
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

  const client = await clientPromise;
  const db = client.db();
  const { datasetType, batchId, taskId } = await params;

  const updatedTask = await req.json(); // The updated task object

  try {
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

  const client = await clientPromise;
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
