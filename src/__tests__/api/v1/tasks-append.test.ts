import { describe, it, expect, beforeEach } from "vitest";
import { POST as AppendTasks, GET as ListTasks } from "@/app/api/v1/batches/[batchId]/tasks/route";
import {
  makeRequest,
  makeJsonRequest,
  mockCaller,
  CALLERS,
  json,
  getDb,
  makeTtsAnnotationBatchDetail,
  makeTtsAnnotationBatchTasks,
  makeTtsEvaluationBatchDetail,
  makeTtsEvaluationBatchTasks,
} from "@/test/helpers";

const batchParams = (batchId: string) => ({ params: Promise.resolve({ batchId }) });

const appendReq = (
  batchId: string,
  body: unknown,
  headers?: Record<string, string>
) =>
  makeJsonRequest(`/api/v1/batches/${batchId}/tasks`, "POST", body, headers);

describe("POST /api/v1/batches/:batchId/tasks (append)", () => {
  beforeEach(async () => {
    mockCaller(CALLERS.root);
    const db = await getDb();
    await db.collection("batches_details").insertOne(makeTtsAnnotationBatchDetail());
    await db.collection("tts_batches").insertOne(makeTtsAnnotationBatchTasks());
  });

  it("appends annotation tasks and updates number_of_tasks", async () => {
    const res = await AppendTasks(
      appendReq("tts-batch-001", { tasks: [{ id: "3", input: "ሓድሽ ጽሑፍ።" }] }),
      batchParams("tts-batch-001")
    );

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data.appended).toBe(1);
    expect(body.data.number_of_tasks).toBe(3);
    expect(body.data.task_ids).toEqual(["3"]);

    const db = await getDb();
    const batch = await db.collection("tts_batches").findOne({ batch_id: "tts-batch-001" });
    expect(batch?.tasks).toHaveLength(3);
    // models is normalized to [] so the annotation UI can rely on its presence
    expect(batch?.tasks[2].models).toEqual([]);

    const detail = await db.collection("batches_details").findOne({ batch_id: "tts-batch-001" });
    expect(detail?.number_of_tasks).toBe(3);
    expect(detail?.annotated_tasks).toBe(0);
  });

  it("appends multiple tasks at once", async () => {
    const res = await AppendTasks(
      appendReq("tts-batch-001", {
        tasks: [
          { id: "3", input: "ሓደ።" },
          { id: "4", input: "ክልተ።" },
        ],
      }),
      batchParams("tts-batch-001")
    );
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.data.appended).toBe(2);
    expect(body.data.number_of_tasks).toBe(4);
  });

  it("rejects a task id that already exists in the batch", async () => {
    const res = await AppendTasks(
      appendReq("tts-batch-001", { tasks: [{ id: "1", input: "ተመሳሳሊ።" }] }),
      batchParams("tts-batch-001")
    );

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.message).toContain("1");

    const db = await getDb();
    const batch = await db.collection("tts_batches").findOne({ batch_id: "tts-batch-001" });
    expect(batch?.tasks).toHaveLength(2);
  });

  it("rejects ids repeated within the payload", async () => {
    const res = await AppendTasks(
      appendReq("tts-batch-001", {
        tasks: [
          { id: "9", input: "ሓደ።" },
          { id: "9", input: "ክልተ።" },
        ],
      }),
      batchParams("tts-batch-001")
    );
    expect(res.status).toBe(409);
  });

  it("matches ids across string/number forms", async () => {
    const res = await AppendTasks(
      appendReq("tts-batch-001", { tasks: [{ id: 1, input: "ቁጽሪ።" }] }),
      batchParams("tts-batch-001")
    );
    expect(res.status).toBe(409);
  });

  it("rejects tasks that fail batch validation", async () => {
    // TTS input must be plain text, never a URL or path
    const res = await AppendTasks(
      appendReq("tts-batch-001", {
        tasks: [{ id: "3", input: "https://example.com/audio.wav" }],
      }),
      batchParams("tts-batch-001")
    );

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a missing or empty tasks array", async () => {
    const empty = await AppendTasks(
      appendReq("tts-batch-001", { tasks: [] }),
      batchParams("tts-batch-001")
    );
    expect(empty.status).toBe(400);

    const missing = await AppendTasks(
      appendReq("tts-batch-001", {}),
      batchParams("tts-batch-001")
    );
    expect(missing.status).toBe(400);
  });

  it("returns 404 for an unknown batch", async () => {
    const res = await AppendTasks(
      appendReq("nope", { tasks: [{ id: "3", input: "ጽሑፍ።" }] }),
      batchParams("nope")
    );
    expect(res.status).toBe(404);
  });

  it("forbids an assigned annotator from appending tasks", async () => {
    const db = await getDb();
    await db
      .collection("batches_details")
      .updateOne(
        { batch_id: "tts-batch-001" },
        { $set: { annotator_id: CALLERS.user.username, created_by: "someone@example.com" } }
      );
    mockCaller(CALLERS.user);

    const res = await AppendTasks(
      appendReq("tts-batch-001", { tasks: [{ id: "3", input: "ጽሑፍ።" }] }),
      batchParams("tts-batch-001")
    );

    expect(res.status).toBe(403);
  });

  it("allows the batch creator to append", async () => {
    const db = await getDb();
    await db
      .collection("batches_details")
      .updateOne(
        { batch_id: "tts-batch-001" },
        { $set: { created_by: CALLERS.user.username } }
      );
    mockCaller(CALLERS.user);

    const res = await AppendTasks(
      appendReq("tts-batch-001", { tasks: [{ id: "3", input: "ጽሑፍ።" }] }),
      batchParams("tts-batch-001")
    );
    expect(res.status).toBe(201);
  });

  it("replays an idempotent append without duplicating tasks", async () => {
    const headers = { "Idempotency-Key": "append-key-1" };
    const first = await AppendTasks(
      appendReq("tts-batch-001", { tasks: [{ id: "3", input: "ሓድሽ።" }] }, headers),
      batchParams("tts-batch-001")
    );
    expect(first.status).toBe(201);

    const replay = await AppendTasks(
      appendReq("tts-batch-001", { tasks: [{ id: "3", input: "ሓድሽ።" }] }, headers),
      batchParams("tts-batch-001")
    );
    expect(replay.status).toBe(200);
    const body = await json(replay);
    expect(body.data.appended).toBe(1);

    const db = await getDb();
    const batch = await db.collection("tts_batches").findOne({ batch_id: "tts-batch-001" });
    expect(batch?.tasks).toHaveLength(3);
  });

  it("makes appended tasks visible through the task list", async () => {
    await AppendTasks(
      appendReq("tts-batch-001", { tasks: [{ id: "3", input: "ሓድሽ።" }] }),
      batchParams("tts-batch-001")
    );

    const res = await ListTasks(
      makeRequest("/api/v1/batches/tts-batch-001/tasks"),
      batchParams("tts-batch-001")
    );
    const body = await json(res);
    expect(body.data.pagination.total_count).toBe(3);
  });

  describe("evaluation batches", () => {
    beforeEach(async () => {
      const db = await getDb();
      await db.collection("batches_details").insertOne(makeTtsEvaluationBatchDetail());
      await db.collection("tts_batches").insertOne(makeTtsEvaluationBatchTasks());
    });

    it("shuffles appended models and merges the shuffle map", async () => {
      const res = await AppendTasks(
        appendReq("tts-eval-001", {
          tasks: [
            {
              id: "2",
              input: "ካልኣይ ጽሑፍ።",
              models: [
                { output: "https://example.com/c.wav", model: "model_a", rate: 0, rank: 0 },
                { output: "https://example.com/d.wav", model: "model_c", rate: 0, rank: 0 },
              ],
            },
          ],
        }),
        batchParams("tts-eval-001")
      );

      expect(res.status).toBe(201);

      const db = await getDb();
      const batch = await db.collection("tts_batches").findOne({ batch_id: "tts-eval-001" });
      // The original task's mapping must survive untouched
      expect(batch?.task_models_shuffles["1"]).toEqual({ A: "model_a", B: "model_b" });
      // The appended task gets its own mapping with anonymized labels
      expect(Object.keys(batch?.task_models_shuffles)).toContain("2");
      expect(batch?.tasks[1].models.map((m: { model: string }) => m.model).sort()).toEqual(["A", "B"]);
      expect(Object.values(batch?.task_models_shuffles["2"]).sort()).toEqual([
        "model_a",
        "model_c",
      ]);

      // A model the batch had not seen before is added to the detail doc
      const detail = await db.collection("batches_details").findOne({ batch_id: "tts-eval-001" });
      expect(detail?.models.sort()).toEqual(["model_a", "model_b", "model_c"]);
      expect(detail?.number_of_tasks).toBe(2);
    });

    it("rejects evaluation tasks that carry no models", async () => {
      const res = await AppendTasks(
        appendReq("tts-eval-001", { tasks: [{ id: "2", input: "ጽሑፍ።" }] }),
        batchParams("tts-eval-001")
      );
      expect(res.status).toBe(400);
    });
  });
});
