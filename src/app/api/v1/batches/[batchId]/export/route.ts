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
  const isAnnotation = datasetType === "tts" && batch.workflow === "annotation";

  // Reviewer exclusions are reported, never silently filtered out. Dropping rows
  // here would make the export disagree with the batch and hide the reviewer's
  // decisions; consumers apply `export_action` themselves and can audit why.
  const exportAction = (task: EvalTaskTypes): "keep" | "drop" =>
    task.excluded ? "drop" : "keep";

  if (format === "csv") {
    // Voice-collection tasks carry no model outputs, so a per-model flatten would
    // emit nothing at all for them. They are one row per recorded prompt instead.
    const rows: Record<string, unknown>[] = isAnnotation
      ? tasks.map((task) => ({
          task_id: task.id,
          text: task.input,
          audio_file_id: task.reference ?? "",
          export_action: exportAction(task),
          excluded: task.excluded ? "true" : "false",
          reviewer_comment: task.reviewer_comment ?? "",
          reviewed_at: task.reviewed_at ?? "",
          active_duration_ms: task.active_duration_ms ?? "",
        }))
      : tasks.flatMap((task) =>
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
              export_action: exportAction(task),
              excluded: task.excluded ? "true" : "false",
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

  // Every task carries an explicit keep/drop verdict so the export is
  // self-describing: a corpus builder filters on `export_action` without needing
  // to know what `excluded` means, and excluded rows stay visible for audit.
  if (Array.isArray(exportData.tasks)) {
    exportData.tasks = (exportData.tasks as EvalTaskTypes[]).map((task) => ({
      ...task,
      excluded: Boolean(task.excluded),
      export_action: exportAction(task),
    }));
  }

  const dropCount = tasks.filter((t) => exportAction(t) === "drop").length;
  exportData.export_summary = {
    total_tasks: tasks.length,
    keep: tasks.length - dropCount,
    drop: dropCount,
  };

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
