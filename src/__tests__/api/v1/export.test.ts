import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/v1/batches/[batchId]/export/route";
import {
  makeRequest,
  mockCaller,
  CALLERS,
  getDb,
  makeMtBatchDetail,
  makeMtBatchTasks,
  makeEvaluatedTasks,
  makeTtsAnnotationBatchDetail,
  makeTtsAnnotationBatchTasks,
} from "@/test/helpers";

const params = (batchId: string) => ({ params: Promise.resolve({ batchId }) });

describe("Export", () => {
  beforeEach(async () => {
    mockCaller(CALLERS.root);
    const db = await getDb();
    await db.collection("batches_details").insertOne(
      makeMtBatchDetail({ annotated_tasks: 2 })
    );
    await db.collection("mt_batches").insertOne(
      makeMtBatchTasks({ tasks: makeEvaluatedTasks() })
    );
  });

  describe("JSON export", () => {
    it("returns JSON with Content-Disposition", async () => {
      const req = makeRequest("/api/v1/batches/batch-001/export?format=json");
      const res = await GET(req, params("batch-001"));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/json");
      expect(res.headers.get("Content-Disposition")).toContain("test-batch.json");

      const body = JSON.parse(await res.text());
      expect(body.tasks).toHaveLength(2);
      expect(body.batch_id).toBe("batch-001");
    });

    it("de-anonymizes with include_original_models", async () => {
      const req = makeRequest("/api/v1/batches/batch-001/export?format=json&include_original_models=true");
      const res = await GET(req, params("batch-001"));
      const body = JSON.parse(await res.text());

      const modelNames = body.tasks[0].models.map((m: { model: string }) => m.model);
      expect(modelNames).toContain("model_a");
      expect(modelNames).toContain("model_b");
    });
  });

  describe("CSV export", () => {
    it("returns CSV with correct headers", async () => {
      const req = makeRequest("/api/v1/batches/batch-001/export?format=csv");
      const res = await GET(req, params("batch-001"));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      expect(res.headers.get("Content-Disposition")).toContain("test-batch.csv");

      const csv = await res.text();
      const lines = csv.split("\n");
      // Header row
      expect(lines[0]).toContain("task_id");
      expect(lines[0]).toContain("input");
      expect(lines[0]).toContain("output");
      expect(lines[0]).toContain("model");
      expect(lines[0]).toContain("rate");
      expect(lines[0]).toContain("rank");
      // Should have 4 data rows (2 tasks x 2 models) + header
      // PapaParse may or may not add trailing newline
      const dataLines = lines.filter((l) => l.trim().length > 0);
      expect(dataLines.length).toBe(5); // 1 header + 4 data
    });
  });

  it("rejects invalid format", async () => {
    const req = makeRequest("/api/v1/batches/batch-001/export?format=xml");
    const res = await GET(req, params("batch-001"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent batch", async () => {
    const req = makeRequest("/api/v1/batches/nope/export");
    const res = await GET(req, params("nope"));
    expect(res.status).toBe(404);
  });

  it("defaults to json format", async () => {
    const req = makeRequest("/api/v1/batches/batch-001/export");
    const res = await GET(req, params("batch-001"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  describe("reviewer exclusions", () => {
    beforeEach(async () => {
      const db = await getDb();
      await db.collection("batches_details").insertOne(
        makeTtsAnnotationBatchDetail({ batch_id: "tts-exp-001" })
      );
      await db.collection("tts_batches").insertOne(
        makeTtsAnnotationBatchTasks({
          batch_id: "tts-exp-001",
          tasks: [
            { id: "1", input: "kept prompt", models: [], reference: "file_a" },
            {
              id: "2",
              input: "dropped prompt",
              models: [],
              reference: "",
              excluded: true,
              reviewer_comment: "scraped page furniture",
            },
          ],
        })
      );
    });

    it("reports excluded segments instead of dropping them from JSON", async () => {
      const res = await GET(
        makeRequest("/api/v1/batches/tts-exp-001/export?format=json"),
        params("tts-exp-001")
      );
      expect(res.status).toBe(200);
      const data = JSON.parse(await res.text());

      // Both rows survive — the export must not disagree with the batch.
      expect(data.tasks).toHaveLength(2);
      expect(data.tasks[0].export_action).toBe("keep");
      expect(data.tasks[1].export_action).toBe("drop");
      // The reason stays attached so the decision is auditable.
      expect(data.tasks[1].reviewer_comment).toBe("scraped page furniture");
      expect(data.export_summary).toEqual({ total_tasks: 2, keep: 1, drop: 1 });
    });

    it("marks unreviewed tasks as keep with an explicit boolean", async () => {
      const res = await GET(
        makeRequest("/api/v1/batches/tts-exp-001/export?format=json"),
        params("tts-exp-001")
      );
      const data = JSON.parse(await res.text());
      expect(data.tasks[0].excluded).toBe(false);
      expect(data.tasks[0].export_action).toBe("keep");
    });

    it("exports annotation batches to CSV as one row per prompt", async () => {
      // Regression: the per-model flatten produced zero rows for voice-collection
      // batches, whose tasks carry no models.
      const res = await GET(
        makeRequest("/api/v1/batches/tts-exp-001/export?format=csv"),
        params("tts-exp-001")
      );
      expect(res.status).toBe(200);
      const csv = await res.text();
      const lines = csv.trim().split("\n");

      expect(lines).toHaveLength(3); // header + 2 prompts
      expect(lines[0]).toContain("export_action");
      expect(lines[0]).toContain("audio_file_id");
      expect(csv).toContain("file_a");
      expect(csv).toContain("drop");
      expect(csv).toContain("keep");
    });
  });
});
