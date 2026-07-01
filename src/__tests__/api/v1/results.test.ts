import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/v1/batches/[batchId]/results/route";
import {
  makeRequest,
  mockCaller,
  CALLERS,
  json,
  getDb,
  makeMtBatchDetail,
  makeMtBatchTasks,
  makeEvaluatedTasks,
} from "@/test/helpers";

const params = (batchId: string) => ({ params: Promise.resolve({ batchId }) });

describe("Results / Leaderboard", () => {
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

  it("returns leaderboard with summary", async () => {
    const req = makeRequest("/api/v1/batches/batch-001/results");
    const res = await GET(req, params("batch-001"));
    expect(res.status).toBe(200);
    const body = await json(res);

    expect(body.data.leaderboard).toBeDefined();
    expect(body.data.leaderboard.length).toBeGreaterThan(0);
    expect(body.data.summary.total_tasks).toBe(2);
    expect(body.data.summary.annotated_tasks).toBe(2);
    expect(body.data.summary.avg_annotation_time_ms).toBe(4000);
  });

  it("de-anonymizes models with include_original_models", async () => {
    const req = makeRequest("/api/v1/batches/batch-001/results?include_original_models=true");
    const res = await GET(req, params("batch-001"));
    const body = await json(res);

    const modelNames = body.data.leaderboard.map((m: { model: string }) => m.model);
    // With shuffles, model names should be original names, not A/B
    expect(modelNames).toContain("model_a");
    expect(modelNames).toContain("model_b");
  });

  it("returns 422 when no evaluated tasks", async () => {
    const db = await getDb();
    // Replace with unevaluated tasks (rate=0)
    await db.collection("mt_batches").updateOne(
      { batch_id: "batch-001" },
      {
        $set: {
          tasks: [
            {
              id: "1",
              input: "Hello",
              models: [
                { output: "x", model: "A", rate: 0, rank: 0 },
                { output: "y", model: "B", rate: 0, rank: 0 },
              ],
            },
          ],
        },
      }
    );

    const req = makeRequest("/api/v1/batches/batch-001/results");
    const res = await GET(req, params("batch-001"));
    expect(res.status).toBe(422);
  });

  it("returns 404 for nonexistent batch", async () => {
    const req = makeRequest("/api/v1/batches/nope/results");
    const res = await GET(req, params("nope"));
    expect(res.status).toBe(404);
  });
});
