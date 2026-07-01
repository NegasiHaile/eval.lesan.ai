import { describe, it, expect, beforeEach } from "vitest";
import { POST, PUT } from "@/app/api/v1/batches/[batchId]/assign/route";
import { DELETE } from "@/app/api/v1/batches/[batchId]/assign/[role]/route";
import {
  makeRequest,
  makeJsonRequest,
  mockCaller,
  CALLERS,
  json,
  getDb,
  makeMtBatchDetail,
  makeUser,
} from "@/test/helpers";

const batchParams = (batchId: string) => ({ params: Promise.resolve({ batchId }) });
const roleParams = (batchId: string, role: string) => ({
  params: Promise.resolve({ batchId, role }),
});

describe("Batch Assignment", () => {
  beforeEach(async () => {
    mockCaller(CALLERS.root);
    const db = await getDb();
    await db.collection("batches_details").insertOne(makeMtBatchDetail());
    await db.collection("user").insertMany([
      makeUser({ email: "annotator@example.com", name: "Annotator" }),
      makeUser({ email: "reviewer@example.com", name: "Reviewer" }),
    ]);
  });

  describe("POST /api/v1/batches/:batchId/assign", () => {
    it("assigns annotator", async () => {
      const req = makeJsonRequest("/api/v1/batches/batch-001/assign", "POST", {
        role: "annotator",
        email: "annotator@example.com",
      });
      const res = await POST(req, batchParams("batch-001"));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.status).toBe("assigned");
      expect(body.data.role).toBe("annotator");

      const db = await getDb();
      const detail = await db.collection("batches_details").findOne({ batch_id: "batch-001" });
      expect(detail!.annotator_id).toBe("annotator@example.com");
    });

    it("assigns reviewer (root only)", async () => {
      const req = makeJsonRequest("/api/v1/batches/batch-001/assign", "POST", {
        role: "reviewer",
        email: "reviewer@example.com",
      });
      const res = await POST(req, batchParams("batch-001"));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.role).toBe("reviewer");
    });

    it("non-root cannot assign reviewer", async () => {
      mockCaller(CALLERS.user);
      const req = makeJsonRequest("/api/v1/batches/batch-001/assign", "POST", {
        role: "reviewer",
        email: "reviewer@example.com",
      });
      const res = await POST(req, batchParams("batch-001"));
      expect(res.status).toBe(403);
    });

    it("returns 409 if already assigned", async () => {
      const db = await getDb();
      await db.collection("batches_details").updateOne(
        { batch_id: "batch-001" },
        { $set: { annotator_id: "existing@example.com" } }
      );

      const req = makeJsonRequest("/api/v1/batches/batch-001/assign", "POST", {
        role: "annotator",
        email: "annotator@example.com",
      });
      const res = await POST(req, batchParams("batch-001"));
      expect(res.status).toBe(409);
      const body = await json(res);
      expect(body.error.code).toBe("CONFLICT");
    });

    it("returns 404 for nonexistent user", async () => {
      const req = makeJsonRequest("/api/v1/batches/batch-001/assign", "POST", {
        role: "annotator",
        email: "nobody@example.com",
      });
      const res = await POST(req, batchParams("batch-001"));
      expect(res.status).toBe(404);
    });

    it("validates required fields", async () => {
      const req = makeJsonRequest("/api/v1/batches/batch-001/assign", "POST", {});
      const res = await POST(req, batchParams("batch-001"));
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/v1/batches/:batchId/assign", () => {
    it("reassigns annotator", async () => {
      const db = await getDb();
      await db.collection("batches_details").updateOne(
        { batch_id: "batch-001" },
        { $set: { annotator_id: "old@example.com" } }
      );

      const req = makeJsonRequest("/api/v1/batches/batch-001/assign", "PUT", {
        role: "annotator",
        email: "annotator@example.com",
      });
      const res = await PUT(req, batchParams("batch-001"));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.status).toBe("reassigned");

      const detail = await db.collection("batches_details").findOne({ batch_id: "batch-001" });
      expect(detail!.annotator_id).toBe("annotator@example.com");
    });

    it("returns 404 for nonexistent batch", async () => {
      const req = makeJsonRequest("/api/v1/batches/nope/assign", "PUT", {
        role: "annotator",
        email: "annotator@example.com",
      });
      const res = await PUT(req, batchParams("nope"));
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/batches/:batchId/assign/:role", () => {
    it("unassigns annotator", async () => {
      const db = await getDb();
      await db.collection("batches_details").updateOne(
        { batch_id: "batch-001" },
        { $set: { annotator_id: "annotator@example.com" } }
      );

      const req = makeRequest("/api/v1/batches/batch-001/assign/annotator", { method: "DELETE" });
      const res = await DELETE(req, roleParams("batch-001", "annotator"));
      expect(res.status).toBe(204);

      const detail = await db.collection("batches_details").findOne({ batch_id: "batch-001" });
      expect(detail!.annotator_id).toBeNull();
    });

    it("non-root cannot unassign reviewer", async () => {
      mockCaller(CALLERS.user);
      const db = await getDb();
      await db.collection("batches_details").updateOne(
        { batch_id: "batch-001" },
        { $set: { created_by: "user@example.com", qa_id: "reviewer@example.com" } }
      );

      const req = makeRequest("/api/v1/batches/batch-001/assign/reviewer", { method: "DELETE" });
      const res = await DELETE(req, roleParams("batch-001", "reviewer"));
      expect(res.status).toBe(403);
    });

    it("rejects invalid role", async () => {
      const req = makeRequest("/api/v1/batches/batch-001/assign/admin", { method: "DELETE" });
      const res = await DELETE(req, roleParams("batch-001", "admin"));
      expect(res.status).toBe(400);
    });
  });
});
