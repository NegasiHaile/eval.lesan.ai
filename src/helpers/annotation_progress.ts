import { EvalTaskTypes, TtsBatchWorkflow } from "@/types/data";

/**
 * Whether a task counts as done, which depends on the batch's workflow.
 *
 * TTS annotation batches are recording work: a task is done once `reference`
 * holds the uploaded file_id. Every other batch is comparison work, where a
 * task is done once at least one model output has been rated.
 */
export function isTaskAnnotated(
  task: EvalTaskTypes,
  workflow?: TtsBatchWorkflow
): boolean {
  // A reviewer-excluded segment will never be recorded, so counting it as
  // outstanding would leave the batch permanently short of complete. It is
  // resolved work; exports drop it rather than treating it as collected audio.
  if (task.excluded) return true;
  if (workflow === "annotation") {
    return Boolean(task.reference?.trim());
  }
  return (
    Array.isArray(task.models) &&
    task.models.some((model) => Number(model.rate) !== 0)
  );
}

export function countAnnotatedTasks(
  tasks: EvalTaskTypes[],
  workflow?: TtsBatchWorkflow
): number {
  if (!Array.isArray(tasks)) return 0;
  return tasks.filter((task) => isTaskAnnotated(task, workflow)).length;
}

/** A task counts as reviewed once a reviewer has saved any decision on it. */
export function isTaskReviewed(task: EvalTaskTypes): boolean {
  return Boolean(task.reviewed_at || task.excluded || task.reviewer_comment?.trim());
}

export function countReviewedTasks(tasks: EvalTaskTypes[]): number {
  if (!Array.isArray(tasks)) return 0;
  return tasks.filter(isTaskReviewed).length;
}
