import { describe, it, expect, beforeEach } from "vitest";
import { GET, PATCH, DELETE } from "@/app/api/v1/batches/[batchId]/route";
import {
  makeRequest,
  makeJsonRequest,
  mockCaller,
  CALLERS,
  json,
  getDb,
  makeMtBatchDetail,
  makeMtBatchTasks,
} from "@/test/helpers";

const params = (batchId: string) => ({ params: Promise.resolve({ batchId }) });

describe("Batch Detail", () => {
  beforeEach(async () => {
    mockCaller(CALLERS.root);
    const db = await getDb();
    await db.collection("batches_details").insertOne(makeMtBatchDetail());
    await db.collection("mt_batches").insertOne(makeMtBatchTasks());
  });

  describe("GET /api/v1/batches/:batchId", () => {
    it("returns full batch with tasks", async () => {
      const req = makeRequest("/api/v1/batches/batch-001");
      const res = await GET(req, params("batch-001"));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.batch_id).toBe("batch-001");
      expect(body.data.tasks).toHaveLength(2);
      expect(body.data.dataset_type).toBe("mt");
      // Shuffles excluded by default
      expect(body.data.task_models_shuffles).toBeUndefined();
    });

    it("includes shuffles when requested", async () => {
      const req = makeRequest("/api/v1/batches/batch-001?include_shuffles=true");
      const res = await GET(req, params("batch-001"));
      const body = await json(res);
      expect(body.data.task_models_shuffles).toBeTruthy();
    });

    it("returns 404 for nonexistent batch", async () => {
      const req = makeRequest("/api/v1/batches/no-such-batch");
      const res = await GET(req, params("no-such-batch"));
      expect(res.status).toBe(404);
    });

    it("non-root cannot access others' batches", async () => {
      mockCaller(CALLERS.user); // user@example.com, not creator
      const req = makeRequest("/api/v1/batches/batch-001");
      const res = await GET(req, params("batch-001"));
      expect(res.status).toBe(403);
    });

    it("annotator can access assigned batch", async () => {
      const db = await getDb();
      await db.collection("batches_details").updateOne(
        { batch_id: "batch-001" },
        { $set: { annotator_id: "annotator@example.com" } }
      );
      mockCaller(CALLERS.annotator);
      const req = makeRequest("/api/v1/batches/batch-001");
      const res = await GET(req, params("batch-001"));
      expect(res.status).toBe(200);
    });
  });

  describe("PATCH /api/v1/batches/:batchId", () => {
    it("updates batch metadata", async () => {
      const req = makeJsonRequest("/api/v1/batches/batch-001", "PATCH", {
        batch_name: "updated-name",
        dataset_domain: "science",
      });
      const res = await PATCH(req, params("batch-001"));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.updated_fields).toContain("batch_name");
      expect(body.data.updated_fields).toContain("dataset_domain");
    });

    it("rejects empty update", async () => {
      const req = makeJsonRequest("/api/v1/batches/batch-001", "PATCH", {
        unknown_field: "value",
      });
      const res = await PATCH(req, params("batch-001"));
      expect(res.status).toBe(400);
    });

    it("non-creator non-root gets 403", async () => {
      mockCaller(CALLERS.user);
      const req = makeJsonRequest("/api/v1/batches/batch-001", "PATCH", {
        batch_name: "nope",
      });
      const res = await PATCH(req, params("batch-001"));
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/v1/batches/:batchId", () => {
    it("deletes batch and tasks", async () => {
      const req = makeRequest("/api/v1/batches/batch-001", { method: "DELETE" });
      const res = await DELETE(req, params("batch-001"));
      expect(res.status).toBe(204);

      const db = await getDb();
      const detail = await db.collection("batches_details").findOne({ batch_id: "batch-001" });
      expect(detail).toBeNull();
      const batch = await db.collection("mt_batches").findOne({ batch_id: "batch-001" });
      expect(batch).toBeNull();
    });

    it("non-creator non-root gets 403", async () => {
      mockCaller(CALLERS.user);
      const req = makeRequest("/api/v1/batches/batch-001", { method: "DELETE" });
      const res = await DELETE(req, params("batch-001"));
      expect(res.status).toBe(403);
    });

    it("returns 404 for nonexistent batch", async () => {
      const req = makeRequest("/api/v1/batches/nope", { method: "DELETE" });
      const res = await DELETE(req, params("nope"));
      expect(res.status).toBe(404);
    });
  });
});
