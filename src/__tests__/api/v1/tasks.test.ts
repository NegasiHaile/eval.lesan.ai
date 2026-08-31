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
  makeTtsAnnotationBatchDetail,
  makeTtsAnnotationBatchTasks,
  makeTtsEvaluationBatchDetail,
  makeTtsEvaluationBatchTasks,
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

    it("reviewer is routed to the review path, not the evaluation path", async () => {
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
      expect(body.data.message).toBe("Review saved.");

      const batch = await db.collection("mt_batches").findOne({ batch_id: "batch-001" });
      const task = batch!.tasks.find((t: { id: string }) => t.id === "1");
      expect(task.reviewer_comment).toBe("Needs improvement");
      // The review path must not touch evaluation data.
      expect(task.models.every((m: { rate: number }) => m.rate === 0)).toBe(true);
    });

    it("reviewer cannot submit ratings through the review path", async () => {
      const db = await getDb();
      await db.collection("batches_details").updateOne(
        { batch_id: "batch-001" },
        { $set: { qa_id: "reviewer@example.com" } }
      );
      mockCaller(CALLERS.reviewer);

      const req = makeJsonRequest("/api/v1/batches/batch-001/tasks/1", "PATCH", {
        reviewer_comment: "ok",
        models: [
          { model: "A", rate: 5, rank: 1 },
          { model: "B", rate: 4, rank: 2 },
        ],
      });
      await PatchTask(req, taskParams("batch-001", "1"));

      const batch = await db.collection("mt_batches").findOne({ batch_id: "batch-001" });
      const task = batch!.tasks.find((t: { id: string }) => t.id === "1");
      expect(task.models.every((m: { rate: number }) => m.rate === 0)).toBe(true);
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

  describe("TTS annotation tasks", () => {
    beforeEach(async () => {
      mockCaller(CALLERS.root);
      const db = await getDb();
      await db.collection("batches_details").insertOne(
        makeTtsAnnotationBatchDetail({ annotator_id: "root@example.com" })
      );
      await db.collection("tts_batches").insertOne(makeTtsAnnotationBatchTasks());
    });

    it("accepts a recording submission with a reference and no models", async () => {
      const req = makeJsonRequest("/api/v1/batches/tts-batch-001/tasks/1", "PATCH", {
        reference: "file_abc123",
        active_duration_ms: 4200,
      });
      const res = await PatchTask(req, taskParams("tts-batch-001", "1"));

      expect(res.status).toBe(200);

      const db = await getDb();
      const batch = await db.collection("tts_batches").findOne({ batch_id: "tts-batch-001" });
      const task = batch!.tasks.find((t: { id: string }) => t.id === "1");
      expect(task.reference).toBe("file_abc123");
      expect(task.active_duration_ms).toBe(4200);
    });

    it("advances annotated_tasks as recordings land", async () => {
      const db = await getDb();

      await PatchTask(
        makeJsonRequest("/api/v1/batches/tts-batch-001/tasks/1", "PATCH", {
          reference: "file_one",
        }),
        taskParams("tts-batch-001", "1")
      );

      let detail = await db.collection("batches_details").findOne({ batch_id: "tts-batch-001" });
      expect(detail?.annotated_tasks).toBe(1);

      await PatchTask(
        makeJsonRequest("/api/v1/batches/tts-batch-001/tasks/2", "PATCH", {
          reference: "file_two",
        }),
        taskParams("tts-batch-001", "2")
      );

      detail = await db.collection("batches_details").findOne({ batch_id: "tts-batch-001" });
      expect(detail?.annotated_tasks).toBe(2);
    });

    it("rejects an annotation submission with no reference", async () => {
      const req = makeJsonRequest("/api/v1/batches/tts-batch-001/tasks/1", "PATCH", {
        active_duration_ms: 1000,
      });
      const res = await PatchTask(req, taskParams("tts-batch-001", "1"));

      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.error.message).toContain("reference");
    });

    it("rejects a blank reference", async () => {
      const req = makeJsonRequest("/api/v1/batches/tts-batch-001/tasks/1", "PATCH", {
        reference: "   ",
      });
      const res = await PatchTask(req, taskParams("tts-batch-001", "1"));
      expect(res.status).toBe(400);
    });

    it("reports annotation tasks through the status filter", async () => {
      await PatchTask(
        makeJsonRequest("/api/v1/batches/tts-batch-001/tasks/1", "PATCH", {
          reference: "file_one",
        }),
        taskParams("tts-batch-001", "1")
      );

      const completed = await ListTasks(
        makeRequest("/api/v1/batches/tts-batch-001/tasks?status=completed"),
        batchParams("tts-batch-001")
      );
      expect((await json(completed)).data.data).toHaveLength(1);

      const pending = await ListTasks(
        makeRequest("/api/v1/batches/tts-batch-001/tasks?status=pending"),
        batchParams("tts-batch-001")
      );
      expect((await json(pending)).data.data).toHaveLength(1);
    });
  });

  describe("TTS reviewer pass (annotation batches)", () => {
    beforeEach(async () => {
      const db = await getDb();
      await db.collection("batches_details").insertOne(
        makeTtsAnnotationBatchDetail({
          batch_id: "tts-rev-001",
          batch_name: "tts-review-batch",
          qa_id: "reviewer@example.com",
          annotator_id: "annotator@example.com",
          created_by: "root@example.com",
        })
      );
      await db.collection("tts_batches").insertOne(
        makeTtsAnnotationBatchTasks({
          batch_id: "tts-rev-001",
          batch_name: "tts-review-batch",
        })
      );
      mockCaller(CALLERS.reviewer);
    });

    const patch = (body: unknown, taskId = "1") =>
      PatchTask(
        makeJsonRequest(`/api/v1/batches/tts-rev-001/tasks/${taskId}`, "PATCH", body),
        taskParams("tts-rev-001", taskId)
      );

    it("lets a reviewer correct the prompt text", async () => {
      const res = await patch({ input: "ጽሑፍ ተስተኻኺሉ።", reviewer_comment: "typo in source" });
      expect(res.status).toBe(200);

      const db = await getDb();
      const batch = await db.collection("tts_batches").findOne({ batch_id: "tts-rev-001" });
      const task = batch!.tasks.find((t: { id: string }) => t.id === "1");
      expect(task.input).toBe("ጽሑፍ ተስተኻኺሉ።");
      expect(task.reviewer_comment).toBe("typo in source");
      expect(task.reviewed_at).toBeTruthy();
    });

    it("keeps an existing recording when the text is corrected", async () => {
      // The whole point: when audio and text disagree, the text is fixed to
      // match what was said, so the take must survive.
      const db = await getDb();
      await db.collection("tts_batches").updateOne(
        { batch_id: "tts-rev-001", "tasks.id": "1" },
        { $set: { "tasks.$.reference": "file_keep_me" } }
      );

      const res = await patch({ input: "what the reader said", reviewer_comment: "matched to audio" });
      expect(res.status).toBe(200);

      const batch = await db.collection("tts_batches").findOne({ batch_id: "tts-rev-001" });
      const task = batch!.tasks.find((t: { id: string }) => t.id === "1");
      expect(task.reference).toBe("file_keep_me");
      expect(task.input).toBe("what the reader said");
    });

    it("lets a reviewer exclude a segment", async () => {
      const res = await patch({ excluded: true, reviewer_comment: "scraped page furniture" });
      expect(res.status).toBe(200);

      const db = await getDb();
      const batch = await db.collection("tts_batches").findOne({ batch_id: "tts-rev-001" });
      const task = batch!.tasks.find((t: { id: string }) => t.id === "1");
      expect(task.excluded).toBe(true);

      // An excluded segment is resolved work, so the batch can still complete.
      const detail = await db.collection("batches_details").findOne({ batch_id: "tts-rev-001" });
      expect(detail?.annotated_tasks).toBe(1);
      expect(detail?.reviewed_tasks).toBe(1);
    });

    it("requires a remark when changing text", async () => {
      const res = await patch({ input: "changed with no reason" });
      expect(res.status).toBe(400);
      const body = await json(res);
      expect(body.error.message).toContain("reviewer_comment");
    });

    it("requires a remark when excluding", async () => {
      const res = await patch({ excluded: true });
      expect(res.status).toBe(400);
    });

    it("allows a bare comment without a remark requirement", async () => {
      const res = await patch({ reviewer_comment: "sounds fine" });
      expect(res.status).toBe(200);
    });

    it("rejects empty text and an empty body", async () => {
      expect((await patch({ input: "   ", reviewer_comment: "x" })).status).toBe(400);
      expect((await patch({})).status).toBe(400);
    });

    it("does not let a reviewer overwrite the recording", async () => {
      const db = await getDb();
      await db.collection("tts_batches").updateOne(
        { batch_id: "tts-rev-001", "tasks.id": "1" },
        { $set: { "tasks.$.reference": "file_original" } }
      );

      await patch({ reference: "file_injected", reviewer_comment: "trying to set audio" });

      const batch = await db.collection("tts_batches").findOne({ batch_id: "tts-rev-001" });
      const task = batch!.tasks.find((t: { id: string }) => t.id === "1");
      expect(task.reference).toBe("file_original");
    });
  });

  describe("TTS evaluation tasks", () => {
    beforeEach(async () => {
      mockCaller(CALLERS.root);
      const db = await getDb();
      await db.collection("batches_details").insertOne(
        makeTtsEvaluationBatchDetail({ annotator_id: "root@example.com" })
      );
      await db.collection("tts_batches").insertOne(makeTtsEvaluationBatchTasks());
    });

    it("still enforces rate/rank rules when the task has models", async () => {
      // Guards the narrowed optionalModelRatings escape hatch: TTS evaluation
      // must not inherit the annotation bypass.
      const req = makeJsonRequest("/api/v1/batches/tts-eval-001/tasks/1", "PATCH", {
        models: [
          { model: "A", rate: 0, rank: 1 },
          { model: "B", rate: 3, rank: 2 },
        ],
      });
      const res = await PatchTask(req, taskParams("tts-eval-001", "1"));
      expect(res.status).toBe(400);
    });

    it("still requires a models array", async () => {
      const req = makeJsonRequest("/api/v1/batches/tts-eval-001/tasks/1", "PATCH", {
        reference: "file_abc",
      });
      const res = await PatchTask(req, taskParams("tts-eval-001", "1"));
      expect(res.status).toBe(400);
    });

    it("accepts a valid evaluation", async () => {
      const req = makeJsonRequest("/api/v1/batches/tts-eval-001/tasks/1", "PATCH", {
        models: [
          { model: "A", rate: 5, rank: 1 },
          { model: "B", rate: 3, rank: 2 },
        ],
      });
      const res = await PatchTask(req, taskParams("tts-eval-001", "1"));
      expect(res.status).toBe(200);

      const db = await getDb();
      const detail = await db.collection("batches_details").findOne({ batch_id: "tts-eval-001" });
      expect(detail?.annotated_tasks).toBe(1);
    });
  });
});
