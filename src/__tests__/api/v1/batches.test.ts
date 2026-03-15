import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/v1/batches/route";
import {
  makeRequest,
  makeJsonRequest,
  mockCaller,
  CALLERS,
  json,
  getDb,
  makeMtBatchDetail,
} from "@/test/helpers";

describe("Batches", () => {
  beforeEach(() => {
    mockCaller(CALLERS.root);
  });

  describe("GET /api/v1/batches", () => {
    it("requires dataset_type param", async () => {
      const req = makeRequest("/api/v1/batches");
      const res = await GET(req);
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("lists batches with pagination", async () => {
      const db = await getDb();
      await db.collection("batches_details").insertMany([
        makeMtBatchDetail({ batch_id: "b1", batch_name: "batch-1", created_at: "2024-01-02T00:00:00Z" }),
        makeMtBatchDetail({ batch_id: "b2", batch_name: "batch-2", created_at: "2024-01-01T00:00:00Z" }),
      ]);

      const req = makeRequest("/api/v1/batches?dataset_type=mt&limit=1");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.data).toHaveLength(1);
      expect(body.data.pagination.has_more).toBe(true);
      expect(body.data.pagination.next_cursor).toBeTruthy();
    });

    it("non-root sees only own batches", async () => {
      mockCaller(CALLERS.user);
      const db = await getDb();
      await db.collection("batches_details").insertMany([
        makeMtBatchDetail({ batch_id: "b1", created_by: "user@example.com" }),
        makeMtBatchDetail({ batch_id: "b2", created_by: "other@example.com" }),
      ]);

      const req = makeRequest("/api/v1/batches?dataset_type=mt");
      const res = await GET(req);
      const body = await json(res);
      expect(body.data.data).toHaveLength(1);
      expect(body.data.data[0].batch_id).toBe("b1");
    });

    it("computes status correctly", async () => {
      const db = await getDb();
      await db.collection("batches_details").insertOne(
        makeMtBatchDetail({ batch_id: "b1", annotator_id: "ann@test.com", annotated_tasks: 1, number_of_tasks: 2 })
      );

      const req = makeRequest("/api/v1/batches?dataset_type=mt");
      const res = await GET(req);
      const body = await json(res);
      expect(body.data.data[0].status).toBe("in_progress");
    });

    it("filters by annotator_id", async () => {
      const db = await getDb();
      await db.collection("batches_details").insertMany([
        makeMtBatchDetail({ batch_id: "b1", annotator_id: "ann1@test.com" }),
        makeMtBatchDetail({ batch_id: "b2", annotator_id: "ann2@test.com" }),
      ]);

      const req = makeRequest("/api/v1/batches?dataset_type=mt&annotator_id=ann1@test.com");
      const res = await GET(req);
      const body = await json(res);
      expect(body.data.data).toHaveLength(1);
      expect(body.data.data[0].batch_id).toBe("b1");
    });
  });

  describe("POST /api/v1/batches", () => {
    const validBatch = {
      dataset_type: "mt",
      batch_name: "new-batch",
      dataset_domain: "news",
      source_language: { iso_639_3: "eng", iso_name: "English" },
      target_language: { iso_639_3: "amh", iso_name: "Amharic" },
      tasks: [
        {
          id: "1",
          input: "Hello world",
          models: [
            { output: "ሰላም ዓለም", model: "model_a", rate: 0, rank: 0 },
            { output: "ሰላም ለዓለም", model: "model_b", rate: 0, rank: 0 },
          ],
        },
      ],
    };

    it("creates a batch successfully", async () => {
      const req = makeJsonRequest("/api/v1/batches", "POST", validBatch);
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await json(res);
      expect(body.data.batch_id).toBeTruthy();
      expect(body.data.batch_name).toBe("new-batch");
      expect(body.data.dataset_type).toBe("mt");
      expect(body.data.number_of_tasks).toBe(1);
      expect(body.data.status).toBe("pending");
    });

    it("returns 409 for duplicate batch name", async () => {
      const req1 = makeJsonRequest("/api/v1/batches", "POST", validBatch);
      await POST(req1);

      const req2 = makeJsonRequest("/api/v1/batches", "POST", validBatch);
      const res = await POST(req2);
      expect(res.status).toBe(409);
      const body = await json(res);
      expect(body.error.code).toBe("CONFLICT");
    });

    it("rejects invalid dataset_type", async () => {
      const req = makeJsonRequest("/api/v1/batches", "POST", {
        ...validBatch,
        dataset_type: "invalid",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("rejects batch with no tasks", async () => {
      const req = makeJsonRequest("/api/v1/batches", "POST", {
        ...validBatch,
        tasks: [],
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns idempotent response on duplicate key", async () => {
      const req1 = makeJsonRequest("/api/v1/batches", "POST", validBatch);
      (req1.headers as Headers).set("idempotency-key", "idem-123");
      const res1 = await POST(req1);
      expect(res1.status).toBe(201);
      const body1 = await json(res1);

      const req2 = makeJsonRequest("/api/v1/batches", "POST", validBatch);
      (req2.headers as Headers).set("idempotency-key", "idem-123");
      const res2 = await POST(req2);
      expect(res2.status).toBe(200);
      const body2 = await json(res2);
      expect(body2.data.batch_id).toBe(body1.data.batch_id);
    });

    it("shuffles and anonymizes models", async () => {
      const req = makeJsonRequest("/api/v1/batches", "POST", validBatch);
      const res = await POST(req);
      const body = await json(res);

      const db = await getDb();
      const batch = await db.collection("mt_batches").findOne({ batch_id: body.data.batch_id });
      expect(batch!.task_models_shuffles).toBeTruthy();
      // Model names in tasks should be anonymized labels
      const modelNames = batch!.tasks[0].models.map((m: { model: string }) => m.model);
      expect(modelNames.every((n: string) => /^[A-Z]+$/.test(n))).toBe(true);
    });
  });
});
