// File: src/app/api/batches/route.ts
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { BatchDetailTypes, BatchTasksTypes } from "@/types/data";
import { requireAuth } from "@/lib/auth";

// GET: Fetch all batch details by [Dataset type]
export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ datasetType: string }>;
  }
) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  try {
    const client = await clientPromise;
    const { datasetType } = await params;

    if (!datasetType) {
      return NextResponse.json(
        { message: "Bad request: 'dataset_type' is required." },
        { status: 400 }
      );
    }

    const db = client.db();

    console.log("Table-name:", `${datasetType}_batches`);

    const batchDetails = await db
      .collection<BatchDetailTypes>(`${datasetType}_batches`)
      .find({})
      .toArray();

    // return NextResponse.json({ batchDetails, batchTasks });
    return NextResponse.json(batchDetails);
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to fetch data", error },
      { status: 500 }
    );
  }
}

// POST: Save new batch detail and its tasks batch
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  try {
    const body = await req.json();
    const {
      batchDetail,
      batchTask,
    }: { batchDetail: BatchDetailTypes; batchTask: BatchTasksTypes } = body;

    const dataset_type = batchDetail.dataset_type;

    if (!dataset_type) {
      return NextResponse.json(
        { message: "Dataset type (mt|asr|tts) is not provided!" },
        { status: 500 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    await db
      .collection<BatchDetailTypes>("batches_details")
      .insertOne(batchDetail);

    await db
      .collection<BatchTasksTypes>(`${dataset_type}_batches`)
      .insertOne(batchTask);

    return NextResponse.json({ message: "Batch data saved successfully" });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to save data", error },
      { status: 500 }
    );
  }
}

// DELETE: Delete batch detail and tasks batch by batch_id
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  try {
    const { batch_id, dataset_type } = await req.json();
    const client = await clientPromise;
    const db = client.db();

    await db
      .collection<BatchDetailTypes>("batches_details")
      .deleteOne({ batch_id });

    await db
      .collection<BatchTasksTypes>(`${dataset_type}_batches`)
      .deleteOne({ batch_id });

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to delete data", error },
      { status: 500 }
    );
  }
}

// PUT: Update batch detail and/or task by batch_id
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  try {
    const body = await req.json();
    const {
      batch_id,
      dataset_type,
      updatedBatchDetail,
      updatedBatchTask,
    }: {
      batch_id: string;
      dataset_type: string;
      updatedBatchDetail?: Partial<BatchDetailTypes>;
      updatedBatchTask?: Partial<BatchTasksTypes>;
    } = body;

    const client = await clientPromise;
    const db = client.db();

    if (updatedBatchDetail) {
      await db
        .collection<BatchDetailTypes>("batches_details")
        .updateOne({ batch_id }, { $set: updatedBatchDetail });
    }

    if (updatedBatchTask) {
      await db
        .collection<BatchTasksTypes>(`${dataset_type}_batches`)
        .updateOne({ batch_id }, { $set: updatedBatchTask });
    }

    return NextResponse.json({ message: "Updated successfully" });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to update data", error },
      { status: 500 }
    );
  }
}
