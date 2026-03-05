import { useState, useCallback } from "react";
import { BatchDetailTypes, EvalTaskTypes } from "@/types/data";

type UseReviewerModeParams = {
  user: { username?: string } | null;
  selectedBatchDetail: BatchDetailTypes;
  batchTasks: EvalTaskTypes[];
  currentTaskIndex: number;
  evalTask: EvalTaskTypes | null;
  setEvalTask: (task: EvalTaskTypes | null) => void;
  setBatchTasks: React.Dispatch<React.SetStateAction<EvalTaskTypes[]>>;
  setCurrentTaskIndex: React.Dispatch<React.SetStateAction<number>>;
};

export function useReviewerMode({
  user,
  selectedBatchDetail,
  batchTasks,
  currentTaskIndex,
  evalTask,
  setEvalTask,
  setBatchTasks,
  setCurrentTaskIndex,
}: UseReviewerModeParams) {
  const [reviewerComment, setReviewerComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  const isReviewerMode = (() => {
    if (!user?.username || !selectedBatchDetail?.qa_id) return false;
    const username = user.username.toLowerCase();
    const qaId = selectedBatchDetail.qa_id.toLowerCase();
    if (qaId !== username) return false;
    const isAnnotator = (selectedBatchDetail.annotator_id ?? "").toLowerCase() === username;
    const isCreator = (selectedBatchDetail.created_by ?? "").toLowerCase() === username;
    return !isAnnotator && !isCreator;
  })();

  const handleSaveReviewerComment = useCallback(async () => {
    if (!evalTask) return;
    setSavingComment(true);
    try {
      const updatedTask = { ...evalTask, reviewer_comment: reviewerComment };
      const res = await fetch(
        `/api/batches/${selectedBatchDetail.dataset_type}/${selectedBatchDetail.batch_id}/tasks/${evalTask.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedTask),
        }
      );
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      setEvalTask(updatedTask);
      const updatedTasks = [...batchTasks];
      updatedTasks[currentTaskIndex] = updatedTask;
      setBatchTasks(updatedTasks);
    } catch (error) {
      alert("Failed to save comment.");
      console.error(error);
    } finally {
      setSavingComment(false);
    }
  }, [evalTask, reviewerComment, selectedBatchDetail, batchTasks, currentTaskIndex, setEvalTask, setBatchTasks]);

  const handleReviewerNext = useCallback(() => {
    if (currentTaskIndex + 1 < batchTasks.length) {
      const nextIndex = currentTaskIndex + 1;
      setCurrentTaskIndex(nextIndex);
      const nextTask = batchTasks[nextIndex];
      setEvalTask(nextTask);
      setReviewerComment(nextTask?.reviewer_comment ?? "");
    } else {
      alert(`End of <${selectedBatchDetail.batch_name}> review tasks!`);
    }
  }, [currentTaskIndex, batchTasks, selectedBatchDetail, setCurrentTaskIndex, setEvalTask]);

  const handleReviewerPrev = useCallback(() => {
    if (currentTaskIndex > 0) {
      const prevIndex = currentTaskIndex - 1;
      setCurrentTaskIndex(prevIndex);
      const prevTask = batchTasks[prevIndex];
      setEvalTask(prevTask);
      setReviewerComment(prevTask?.reviewer_comment ?? "");
    }
  }, [currentTaskIndex, batchTasks, setCurrentTaskIndex, setEvalTask]);

  return {
    isReviewerMode,
    reviewerComment,
    setReviewerComment,
    savingComment,
    handleSaveReviewerComment,
    handleReviewerNext,
    handleReviewerPrev,
  };
}
