export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import getClientPromise from "@/lib/mongodb";
import { resolveApiCaller } from "@/lib/api-auth";
import { apiError, ErrorCodes } from "@/lib/api-errors";
import type { BatchDetailTypes, EvalTaskTypes } from "@/types/data";

type RouteParams = { params: Promise<{ batchId: string }> };

/** GET /api/v1/batches/{batchId}/export — Download annotated data as JSON or CSV. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const caller = await resolveApiCaller(req, "batches:read");
  if (caller instanceof Response) return caller;

  const { batchId } = await params;
  const format = req.nextUrl.searchParams.get("format")?.toLowerCase() ?? "json";
  const includeOriginalModels =
    req.nextUrl.searchParams.get("include_original_models") === "true";

  if (!["json", "csv"].includes(format)) {
    return apiError(ErrorCodes.VALIDATION_FAILED, "Format must be 'json' or 'csv'.", 400);
  }

  const client = await getClientPromise();
  const db = client.db();

  const detail = await db
    .collection<BatchDetailTypes>("batches_details")
    .findOne({ batch_id: batchId });

  if (!detail) {
    return apiError(ErrorCodes.NOT_FOUND, `Batch '${batchId}' not found.`, 404);
  }

  // Authorization
  if (caller.role !== "root") {
    const email = caller.username.toLowerCase();
    const isOwner =
      detail.created_by?.toLowerCase() === email ||
      detail.annotator_id?.toLowerCase() === email ||
      detail.qa_id?.toLowerCase() === email;
    if (!isOwner) {
      return apiError(ErrorCodes.FORBIDDEN, "You do not have access to this batch.", 403);
    }
  }

  const datasetType = detail.dataset_type ?? "mt";
  const batch = await db
    .collection(`${datasetType}_batches`)
    .findOne({ batch_id: batchId });

  if (!batch || !Array.isArray(batch.tasks)) {
    return apiError(ErrorCodes.NOT_FOUND, `Batch task data for '${batchId}' not found.`, 404);
  }

  const shuffles = includeOriginalModels
    ? (batch.task_models_shuffles as Record<string, Record<string, string>> | undefined)
    : undefined;

  const tasks: EvalTaskTypes[] = batch.tasks;
  const batchName = detail.batch_name ?? batchId;

  if (format === "csv") {
    // Flatten: one row per task-model
    const rows = tasks.flatMap((task) =>
      task.models.map((m) => {
        const modelName = shuffles?.[task.id]?.[m.model] ?? m.model;
        return {
          task_id: task.id,
          input: task.input,
          output: m.output,
          model: modelName,
          domain: Array.isArray(task.domain) ? task.domain.join(", ") : "",
          rate: m.rate,
          rank: m.rank,
          reference: task.reference ?? "",
          reviewer_comment: task.reviewer_comment ?? "",
        };
      })
    );

    const csv = Papa.unparse(rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${batchName}.csv"`,
      },
    });
  }

  // JSON export
  const exportData: Record<string, unknown> = { ...batch };
  delete exportData._id;

  // De-anonymize model names if requested
  if (shuffles && Array.isArray(exportData.tasks)) {
    for (const task of exportData.tasks as EvalTaskTypes[]) {
      const taskShuffles = shuffles[task.id];
      if (taskShuffles) {
        for (const m of task.models) {
          if (taskShuffles[m.model]) {
            m.model = taskShuffles[m.model];
          }
        }
      }
    }
  }

  const jsonStr = JSON.stringify(exportData, null, 2);

  return new NextResponse(jsonStr, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${batchName}.json"`,
    },
  });
}
