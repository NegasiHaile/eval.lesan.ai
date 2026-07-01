import { describe, it, expect, beforeEach } from "vitest";
import { GET as ListTasks } from "@/app/api/v1/batches/[batchId]/tasks/route";
import { GET as GetTask, PATCH as PatchTask } from "@/app/api/v1/batches/[batchId]/tasks/[taskId]/route";
import {
  makeRequest,
  makeJsonRequest,
  mockCaller,
  CALLERS,
  json,
  getDb,
  makeMtBatchDetail,
  makeMtBatchTasks,
  makeEvaluatedTasks,
} from "@/test/helpers";

const batchParams = (batchId: string) => ({ params: Promise.resolve({ batchId }) });
const taskParams = (batchId: string, taskId: string) => ({
  params: Promise.resolve({ batchId, taskId }),
});

describe("Tasks", () => {
  beforeEach(async () => {
    mockCaller(CALLERS.root);
    const db = await getDb();
    await db.collection("batches_details").insertOne(
      makeMtBatchDetail({ annotator_id: "root@example.com" })
    );
    await db.collection("mt_batches").insertOne(makeMtBatchTasks());
  });

  describe("GET /api/v1/batches/:batchId/tasks", () => {
    it("returns paginated tasks", async () => {
      const req = makeRequest("/api/v1/batches/batch-001/tasks?limit=1");
      const res = await ListTasks(req, batchParams("batch-001"));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.data).toHaveLength(1);
      expect(body.data.pagination.has_more).toBe(true);
      expect(body.data.pagination.total_count).toBe(2);
    });

    it("filters pending tasks", async () => {
      const req = makeRequest("/api/v1/batches/batch-001/tasks?status=pending");
      const res = await ListTasks(req, batchParams("batch-001"));
      const body = await json(res);
      // All tasks have rate=0, so all are pending
      expect(body.data.data).toHaveLength(2);
    });

    it("filters completed tasks", async () => {
      const db = await getDb();
      await db.collection("mt_batches").updateOne(
        { batch_id: "batch-001" },
        { $set: { tasks: makeEvaluatedTasks() } }
      );

      const req = makeRequest("/api/v1/batches/batch-001/tasks?status=completed");
      const res = await ListTasks(req, batchParams("batch-001"));
      const body = await json(res);
      expect(body.data.data).toHaveLength(2);
    });

    it("returns 404 for nonexistent batch", async () => {
      const req = makeRequest("/api/v1/batches/nope/tasks");
      const res = await ListTasks(req, batchParams("nope"));
      expect(res.status).toBe(404);
    });

    it("non-owner gets 403", async () => {
      mockCaller(CALLERS.user);
      const req = makeRequest("/api/v1/batches/batch-001/tasks");
      const res = await ListTasks(req, batchParams("batch-001"));
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/batches/:batchId/tasks/:taskId", () => {
    it("returns single task by string ID", async () => {
      const req = makeRequest("/api/v1/batches/batch-001/tasks/1");
      const res = await GetTask(req, taskParams("batch-001", "1"));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.id).toBe("1");
      expect(body.data.models).toHaveLength(2);
    });

    it("returns 404 for nonexistent task", async () => {
      const req = makeRequest("/api/v1/batches/batch-001/tasks/999");
      const res = await GetTask(req, taskParams("batch-001", "999"));
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/batches/:batchId/tasks/:taskId", () => {
    it("submits evaluation successfully", async () => {
      const req = makeJsonRequest("/api/v1/batches/batch-001/tasks/1", "PATCH", {
        models: [
          { model: "A", rate: 4, rank: 1 },
          { model: "B", rate: 3, rank: 2 },
        ],
      });
      const res = await PatchTask(req, taskParams("batch-001", "1"));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.task_id).toBe("1");

      // Check annotated_tasks was updated
      const db = await getDb();
      const detail = await db.collection("batches_details").findOne({ batch_id: "batch-001" });
      expect(detail!.annotated_tasks).toBe(1);
    });

    it("rejects unrated models", async () => {
      const req = makeJsonRequest("/api/v1/batches/batch-001/tasks/1", "PATCH", {
        models: [
          { model: "A", rate: 0, rank: 1 },
          { model: "B", rate: 3, rank: 2 },
        ],
      });
      const res = await PatchTask(req, taskParams("batch-001", "1"));
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("rejects duplicate ranks", async () => {
      const req = makeJsonRequest("/api/v1/batches/batch-001/tasks/1", "PATCH", {
        models: [
          { model: "A", rate: 4, rank: 1 },
          { model: "B", rate: 3, rank: 1 },
        ],
      });
      const res = await PatchTask(req, taskParams("batch-001", "1"));
      expect(res.status).toBe(400);
    });

    it("rejects rate/rank inconsistency", async () => {
      const req = makeJsonRequest("/api/v1/batches/batch-001/tasks/1", "PATCH", {
        models: [
          { model: "A", rate: 5, rank: 2 }, // higher rate but worse rank
          { model: "B", rate: 3, rank: 1 },
        ],
      });
      const res = await PatchTask(req, taskParams("batch-001", "1"));
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.error.code).toBe("RATE_RANK_INCONSISTENT");
    });

    it("rejects missing models array", async () => {
      const req = makeJsonRequest("/api/v1/batches/batch-001/tasks/1", "PATCH", {
        reviewer_comment: "looks good",
      });
      // Caller is root + annotator, so it goes to annotator path, not reviewer path
      const res = await PatchTask(req, taskParams("batch-001", "1"));
      expect(res.status).toBe(400);
    });

    it("reviewer can only update reviewer_comment", async () => {
      const db = await getDb();
      await db.collection("batches_details").updateOne(
        { batch_id: "batch-001" },
        { $set: { qa_id: "reviewer@example.com" } }
      );
      mockCaller(CALLERS.reviewer);

      const req = makeJsonRequest("/api/v1/batches/batch-001/tasks/1", "PATCH", {
        reviewer_comment: "Needs improvement",
      });
      const res = await PatchTask(req, taskParams("batch-001", "1"));
      expect(res.status).toBe(200);
      const body = await json(res);
      expect(body.data.message).toBe("Reviewer comment updated.");
    });

    it("ignores reviewer_comment supplied by a non-reviewer annotator", async () => {
      const db = await getDb();
      await db.collection("batches_details").updateOne(
        { batch_id: "batch-001" },
        { $set: { annotator_id: "annotator@example.com", qa_id: "reviewer@example.com" } }
      );
      mockCaller(CALLERS.annotator);

      const req = makeJsonRequest("/api/v1/batches/batch-001/tasks/1", "PATCH", {
        models: [
          { model: "A", rate: 5, rank: 1 },
          { model: "B", rate: 3, rank: 2 },
        ],
        reviewer_comment: "sneaking this in",
      });
      const res = await PatchTask(req, taskParams("batch-001", "1"));
      expect(res.status).toBe(200);

      const batch = await db.collection("mt_batches").findOne({ batch_id: "batch-001" });
      const task = batch!.tasks.find((t: { id: string }) => t.id === "1");
      expect(task.reviewer_comment).toBeUndefined();
    });

    it("rejects a reviewer PATCH that omits reviewer_comment", async () => {
      const db = await getDb();
      await db.collection("batches_details").updateOne(
        { batch_id: "batch-001" },
        { $set: { qa_id: "reviewer@example.com" } }
      );
      mockCaller(CALLERS.reviewer);

      const req = makeJsonRequest("/api/v1/batches/batch-001/tasks/1", "PATCH", {});
      const res = await PatchTask(req, taskParams("batch-001", "1"));
      expect(res.status).toBe(400);
    });
  });
});
