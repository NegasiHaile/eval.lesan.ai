import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { EvalTaskTypes, EvalOutputTypes } from "@/types/data";
import { requireAuth } from "@/lib/auth";

type RouteParams = {
  datasetType: string;
  batchId: string;
};

/* ===================== GET ===================== */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { datasetType, batchId } = await params;

  if (!datasetType) {
    return NextResponse.json(
      { message: "Dataset type (mt|asr|tts) is not defined!" },
      { status: 500 }
    );
  }

  const client = await clientPromise;
  const db = client.db();

  const batch = await db
    .collection(`${datasetType}_batches`)
    .findOne({ batch_id: batchId });

  if (!batch) {
    return NextResponse.json({ message: "Batch not found" }, { status: 404 });
  }

  const includeModelShuffles =
    req.nextUrl.searchParams.get("include_models_shuffles") === "true";

  if (!includeModelShuffles && "task_models_shuffles" in batch) {
    const b = batch as Record<string, unknown>;
    delete b.task_models_shuffles;
  }

  return NextResponse.json(batch);
}

/* ===================== PUT ===================== */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { datasetType, batchId } = await params;

  if (!datasetType) {
    return NextResponse.json(
      { message: "Dataset type (mt|asr|tts) is not defined!" },
      { status: 500 }
    );
  }

  const body = await req.json();
  delete body._id;

  const ratedTaskCount = Array.isArray(body.tasks)
    ? body.tasks.filter(
        (task: EvalTaskTypes) =>
          Array.isArray(task.models) &&
          task.models.some(
            (output: EvalOutputTypes) => Number(output.rate) !== 0
          )
      ).length
    : 0;

  body.annotated_tasks = ratedTaskCount;

  const client = await clientPromise;
  const db = client.db();

  const result = await db
    .collection(`${datasetType}_batches`)
    .updateOne({ batch_id: batchId }, { $set: body });

  if (result.matchedCount === 0) {
    return NextResponse.json({ message: "Batch not found" }, { status: 404 });
  }

  await db
    .collection("batches_details")
    .updateOne(
      { batch_id: batchId },
      { $set: { annotated_tasks: ratedTaskCount } }
    );

  return NextResponse.json({
    message: "Your work is saved successfully",
    annotated_tasks: ratedTaskCount,
  });
}

/* ===================== DELETE ===================== */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { datasetType, batchId } = await params;

  if (!datasetType) {
    return NextResponse.json(
      { message: "Dataset type (mt|asr|tts) is not defined!" },
      { status: 500 }
    );
  }

  const client = await clientPromise;
  const db = client.db();

  const result = await db
    .collection(`${datasetType}_batches`)
    .deleteOne({ batch_id: batchId });

  if (result.deletedCount === 0) {
    return NextResponse.json({ message: "Batch not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Batch deleted successfully" });
}
