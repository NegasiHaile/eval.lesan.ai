import { describe, it, expect } from "vitest";
import {
  isTaskAnnotated,
  countAnnotatedTasks,
  isTaskReviewed,
  countReviewedTasks,
} from "@/helpers/annotation_progress";
import type { EvalTaskTypes } from "@/types/data";

const task = (overrides: Partial<EvalTaskTypes> = {}): EvalTaskTypes => ({
  id: "1",
  input: "text",
  models: [],
  ...overrides,
});

describe("isTaskAnnotated", () => {
  describe("annotation workflow", () => {
    it("counts a task with a reference as done", () => {
      expect(isTaskAnnotated(task({ reference: "file_abc" }), "annotation")).toBe(true);
    });

    it("ignores an empty or whitespace-only reference", () => {
      expect(isTaskAnnotated(task({ reference: "" }), "annotation")).toBe(false);
      expect(isTaskAnnotated(task({ reference: "  " }), "annotation")).toBe(false);
      expect(isTaskAnnotated(task(), "annotation")).toBe(false);
    });

    it("does not fall back to ratings", () => {
      const rated = task({
        models: [{ output: "a", model: "A", rate: 5, rank: 1 }],
      });
      expect(isTaskAnnotated(rated, "annotation")).toBe(false);
    });
  });

  describe("evaluation and other workflows", () => {
    it("counts a rated task as done", () => {
      const rated = task({
        models: [{ output: "a", model: "A", rate: 3, rank: 1 }],
      });
      expect(isTaskAnnotated(rated, "evaluation")).toBe(true);
      expect(isTaskAnnotated(rated)).toBe(true);
    });

    it("does not count an unrated task", () => {
      const unrated = task({
        models: [{ output: "a", model: "A", rate: 0, rank: 0 }],
      });
      expect(isTaskAnnotated(unrated, "evaluation")).toBe(false);
      expect(isTaskAnnotated(unrated)).toBe(false);
    });

    it("does not treat a reference as an evaluation", () => {
      expect(isTaskAnnotated(task({ reference: "file_abc" }), "evaluation")).toBe(false);
    });

    it("handles a missing models array", () => {
      expect(
        isTaskAnnotated({ id: "1", input: "x" } as EvalTaskTypes, "evaluation")
      ).toBe(false);
    });
  });
});

describe("countAnnotatedTasks", () => {
  it("counts annotation tasks by reference", () => {
    const tasks = [
      task({ id: "1", reference: "file_a" }),
      task({ id: "2", reference: "" }),
      task({ id: "3", reference: "file_c" }),
    ];
    expect(countAnnotatedTasks(tasks, "annotation")).toBe(2);
  });

  it("counts evaluation tasks by rating", () => {
    const tasks = [
      task({ id: "1", models: [{ output: "a", model: "A", rate: 4, rank: 1 }] }),
      task({ id: "2", models: [{ output: "b", model: "A", rate: 0, rank: 0 }] }),
    ];
    expect(countAnnotatedTasks(tasks, "evaluation")).toBe(1);
  });

  it("returns 0 for a non-array", () => {
    expect(countAnnotatedTasks(undefined as unknown as EvalTaskTypes[], "annotation")).toBe(0);
  });
});

describe("reviewer exclusions", () => {
  it("treats an excluded segment as resolved, not outstanding", () => {
    // Otherwise a batch containing an excluded prompt could never complete:
    // nobody will ever record it.
    expect(isTaskAnnotated(task({ excluded: true }), "annotation")).toBe(true);
    expect(isTaskAnnotated(task({ excluded: true }), "evaluation")).toBe(true);
  });

  it("counts excluded segments toward batch completion", () => {
    const tasks = [
      task({ id: "1", reference: "file_a" }),
      task({ id: "2", excluded: true }),
      task({ id: "3" }),
    ];
    expect(countAnnotatedTasks(tasks, "annotation")).toBe(2);
  });
});

describe("isTaskReviewed", () => {
  it("counts any saved reviewer decision", () => {
    expect(isTaskReviewed(task({ reviewed_at: "2026-08-31T00:00:00Z" }))).toBe(true);
    expect(isTaskReviewed(task({ excluded: true }))).toBe(true);
    expect(isTaskReviewed(task({ reviewer_comment: "looks fine" }))).toBe(true);
  });

  it("does not count an untouched or blank-commented task", () => {
    expect(isTaskReviewed(task())).toBe(false);
    expect(isTaskReviewed(task({ reviewer_comment: "   " }))).toBe(false);
  });

  it("counts across a batch", () => {
    expect(
      countReviewedTasks([task({ id: "1", excluded: true }), task({ id: "2" })])
    ).toBe(1);
  });
});
