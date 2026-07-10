import { describe, expect, it } from "vitest";
import { isValidBatchData } from "@/helpers/validate_uploading_batch";
import type { TtsBatchTasksTypes, BatchTasksTypes } from "@/types/data";

const ttsAnnotationBatch: TtsBatchTasksTypes = {
  batch_name: "HornTTS-Health-01",
  dataset_name: "HornTTS",
  dataset_domain: "Health",
  workflow: "annotation",
  language: {
    iso_name: "Tigrinya",
    iso_639_1: "ti",
    iso_639_3: "tir",
  },
  tasks: [
    {
      id: "1",
      input: "Hello world",
      reference: "",
      domain: [],
    } as unknown as TtsBatchTasksTypes["tasks"][number],
  ],
};

const ttsEvaluationBatch: TtsBatchTasksTypes = {
  ...ttsAnnotationBatch,
  workflow: "evaluation",
  tasks: [
    {
      id: "1",
      input: "Hello world",
      models: [
        { output: "/datasets/sample.mp3", model: "A", rate: 0, rank: 0 },
      ],
    },
  ],
};

describe("isValidBatchData for TTS", () => {
  it("accepts annotation batches with workflow annotation and no models", () => {
    const result = isValidBatchData("tts", ttsAnnotationBatch, {
      requireMetadata: true,
    });
    expect(result.isValid).toBe(true);
  });

  it("rejects tasks without models when workflow is evaluation", () => {
    const result = isValidBatchData(
      "tts",
      {
        ...ttsAnnotationBatch,
        workflow: "evaluation",
      },
      { requireMetadata: true }
    );
    expect(result.isValid).toBe(false);
    expect(result.message).toBe(
      `Validation failed:\n- ${'Evaluation TTS tasks require a "models" array with at least one model.'}`
    );
  });

  it("requires workflow for TTS batches", () => {
    const { workflow: _workflow, ...withoutWorkflow } = ttsAnnotationBatch;
    const result = isValidBatchData("tts", withoutWorkflow, {
      requireMetadata: true,
    });
    expect(result.isValid).toBe(false);
    expect(result.message).toBe(
      'Validation failed:\n- "workflow" must be "annotation" or "evaluation".'
    );
  });

  it("rejects invalid workflow values", () => {
    const result = isValidBatchData(
      "tts",
      { ...ttsAnnotationBatch, workflow: "invalid" as "annotation" },
      { requireMetadata: true }
    );
    expect(result.isValid).toBe(false);
    expect(result.message).toBe(
      'Validation failed:\n- "workflow" must be "annotation" or "evaluation".'
    );
  });

  it("requires models for evaluation workflow", () => {
    const result = isValidBatchData("tts", ttsEvaluationBatch, {
      requireMetadata: true,
    });
    expect(result.isValid).toBe(true);
  });

  it("rejects workflow on non-TTS batches", () => {
    const result = isValidBatchData(
      "mt",
      {
        batch_name: "Batch",
        dataset_name: "Batch",
        dataset_domain: "News",
        source_language: { iso_name: "English", iso_639_1: "en", iso_639_3: "eng" },
        target_language: { iso_name: "Amharic", iso_639_1: "am", iso_639_3: "amh" },
        workflow: "annotation",
        tasks: [],
      } as BatchTasksTypes & { workflow: string },
      { requireMetadata: true }
    );
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("only supported for TTS");
  });
});
