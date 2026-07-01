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
});
