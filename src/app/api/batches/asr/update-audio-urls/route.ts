export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import getClientPromise from "@/lib/mongodb";
import { BatchDetailTypes } from "@/types/data";
import { requireAuth } from "@/lib/auth";

/** Request body: one batch at a time. Match tasks by id and update only input. */
type UpdateAudioUrlsBody = {
  batch_name: string;
  tasks: Array<{ id: string | number; input: string }>;
};

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const body = (await req.json()) as UpdateAudioUrlsBody;
    const { batch_name, tasks } = body;

    if (!batch_name || typeof batch_name !== "string" || !batch_name.trim()) {
      return NextResponse.json(
        { message: "batch_name is required and must be a non-empty string." },
        { status: 400 }
      );
    }
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { message: "tasks array is required and must not be empty." },
        { status: 400 }
      );
    }

    const client = await getClientPromise();
    const db = client.db();

    const detail = await db
      .collection<BatchDetailTypes>("batches_details")
      .findOne({
        batch_name: batch_name.trim(),
        dataset_type: "asr",
      });

    if (!detail) {
      return NextResponse.json(
        { message: `No ASR batch found with batch_name "${batch_name}".` },
        { status: 404 }
      );
    }

    const isAdminOrRoot = ["root", "admin"].includes(auth.role.toLowerCase());
    const isCreator =
      (detail.created_by ?? "").toLowerCase() === auth.username.toLowerCase();
    const isAssignedAnnotator =
      (detail.annotator_id ?? "").toLowerCase() === auth.username.toLowerCase();
    if (!isAdminOrRoot && !isCreator && !isAssignedAnnotator) {
      return NextResponse.json(
        {
          message:
            "Forbidden. Only the batch creator, assigned annotator, or an admin can update audio URLs.",
        },
        { status: 403 }
      );
    }

    const batchId = detail.batch_id;
    const asrBatch = await db
      .collection("asr_batches")
      .findOne({ batch_id: batchId });

    if (!asrBatch) {
      return NextResponse.json(
        { message: `Batch "${batch_name}" not found in asr_batches.` },
        { status: 404 }
      );
    }

    const existingTasks = (asrBatch.tasks ?? []) as Array<{
      id: string | number;
      input: string;
      [k: string]: unknown;
    }>;
    const inputByTaskId = new Map<string, string>();
    for (const t of tasks) {
      if (t != null && "id" in t && typeof t.input === "string") {
        inputByTaskId.set(String(t.id), t.input);
      }
    }

    const updatedTasks = existingTasks.map((task) => {
      const newInput = inputByTaskId.get(String(task.id));
      if (newInput !== undefined) {
        return { ...task, input: newInput };
      }
      return task;
    });

    await db.collection("asr_batches").updateOne(
      { batch_id: batchId },
      { $set: { tasks: updatedTasks } }
    );

    return NextResponse.json({
      message: "Audio URLs updated successfully.",
      batch_id: batchId,
      batch_name: batch_name.trim(),
      tasks_updated: updatedTasks.filter((t) => inputByTaskId.has(String(t.id))).length,
    });
  } catch (error) {
    console.error("Update audio URLs error:", error);
    return NextResponse.json(
      { message: "Failed to update audio URLs.", error: String(error) },
      { status: 500 }
    );
  }
}
