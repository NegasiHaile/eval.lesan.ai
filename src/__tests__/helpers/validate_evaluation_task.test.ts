import { describe, it, expect } from "vitest";
import { validateEvaluationTask } from "@/helpers/validate_evaluation_task";
import type { EvalTaskTypes } from "@/types/data";

const task = (models: EvalTaskTypes["models"]): EvalTaskTypes => ({
  id: "1",
  input: "text",
  models,
});

describe("validateEvaluationTask", () => {
  it("accepts a well-formed evaluation", () => {
    const result = validateEvaluationTask(
      task([
        { output: "a", model: "A", rate: 5, rank: 1 },
        { output: "b", model: "B", rate: 3, rank: 2 },
      ])
    );
    expect(result.isValid).toBe(true);
  });

  it("rejects unrated models", () => {
    const result = validateEvaluationTask(
      task([{ output: "a", model: "A", rate: 0, rank: 1 }])
    );
    expect(result.isValid).toBe(false);
    expect(result.errorTitles).toEqual(["A"]);
  });

  it("rejects duplicate ranks", () => {
    const result = validateEvaluationTask(
      task([
        { output: "a", model: "A", rate: 4, rank: 1 },
        { output: "b", model: "B", rate: 3, rank: 1 },
      ])
    );
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("unique rank");
  });

  it("rejects rank/rate inconsistency", () => {
    const result = validateEvaluationTask(
      task([
        { output: "a", model: "A", rate: 5, rank: 2 },
        { output: "b", model: "B", rate: 2, rank: 1 },
      ])
    );
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("Ranking must reflect rating");
  });

  describe("empty models", () => {
    // TTS annotation tasks are recordings, not comparisons: they carry
    // `models: []`. Every rule above is vacuous over an empty list, so such a
    // task validates without needing a special bypass — the v1 task PATCH
    // relies on this.
    it("accepts a task with no models", () => {
      expect(validateEvaluationTask(task([])).isValid).toBe(true);
    });

    it("still fails a task that has an unrated model", () => {
      expect(
        validateEvaluationTask(task([{ output: "a", model: "A", rate: 0, rank: 0 }]))
          .isValid
      ).toBe(false);
    });
  });
});
