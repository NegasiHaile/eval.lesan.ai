"use client";

import { useEffect, useRef, useState } from "react";

import AudioCard from "@/components/inputs/AudioCard";
import SelectOption from "@/components/inputs/SelectOption";
import SelectTransparent from "@/components/inputs/SelectTransparent";
import TranslationInputTextarea from "@/components/inputs/TranslationInputTextarea";
import DomainsList from "@/components/DomainsList";
import Container from "@/components/utils/Container";
import Button from "@/components/utils/Button";
import Modal from "@/components/utils/Modal";
import ReviewerPanel from "@/components/ReviewerPanel";
import ReviewerCommentDisplay from "@/components/ReviewerCommentDisplay";
import { useUser } from "@/context/UserContext";
import { useReviewerMode } from "@/hooks/useReviewerMode";
import { usePresence } from "@/hooks/usePresence";
import { useTaskDuration } from "@/hooks/useTaskDuration";
import { languages } from "@/constants/languages";
import { ttsRealtimeBatch, ttsBatchTemplate } from "@/constants/initial_values";
import { generate_realtime_tts_batch } from "@/scripts/generat_eval_data";
import { ttsModels } from "@/constants/models";
import { validateEvaluationTask } from "@/helpers/validate_evaluation_task";
import TTSAnnotationPanel from "@/components/inputs/TTSAnnotationPanel";
import { referenceAudioFilename } from "@/helpers/reference_audio_filename";
import { normalizeAudioContentType } from "@/constants/transcription";
import {
  ASRBatchTasksTypes,
  BatchDetailTypes,
  EvalTaskTypes,
} from "@/types/data";
import { TaskEvalErrorTypes } from "@/types/others";
import { Minus, Plus } from "lucide-react";

export default function TTSPage() {
  const { user } = useUser();
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
    variant?: "info" | "success" | "error";
  } | null>(null);

  const [batchesDetails, setBatchesDetails] = useState<BatchDetailTypes[]>([
    ttsRealtimeBatch,
  ]);
  const [selectedBatchDetail, setSelectedBatchDetail] =
    useState<BatchDetailTypes>(ttsRealtimeBatch);
  const [batchTasks, setBatchTasks] = useState<EvalTaskTypes[]>([]);
  const [evalTask, setEvalTask] = useState<EvalTaskTypes | null>(null);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [modelsToEval, setModelsToEval] = useState<number>(2);
  const [error, setError] = useState<TaskEvalErrorTypes | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showReference, setShowReference] = useState(false);
  const [uploadingReference, setUploadingReference] = useState(false);
  const batchTasksRef = useRef(batchTasks);
  const currentTaskIndexRef = useRef(currentTaskIndex);
  const evalTaskRef = useRef(evalTask);
  batchTasksRef.current = batchTasks;
  currentTaskIndexRef.current = currentTaskIndex;
  evalTaskRef.current = evalTask;

  const {
    isReviewerMode,
    reviewerComment,
    setReviewerComment,
    savingComment,
    handleSaveReviewerComment,
    handleReviewerNext,
    handleReviewerPrev,
  } = useReviewerMode({
    user,
    selectedBatchDetail,
    batchTasks,
    currentTaskIndex,
    evalTask,
    setEvalTask,
    setBatchTasks,
    setCurrentTaskIndex,
    onNotice: (title, message, variant) =>
      setNotice({ title, message, variant }),
  });

  usePresence(user, selectedBatchDetail?.batch_id);
  const { getStartedAt, getActiveDurationMs } = useTaskDuration(evalTask?.id);

  const IsRealtime = () =>
    selectedBatchDetail?.batch_name?.toLowerCase().includes("realtime");

  const handleResetEvalTask = (num_models: number) => {
    const rtBatch: ASRBatchTasksTypes = generate_realtime_tts_batch(
      num_models,
      "realtime",
      selectedBatchDetail.source_language.iso_639_3 || "eng"
    );
    setEvalTask({ ...rtBatch.tasks[0] });
    setBatchTasks([...rtBatch.tasks]);
  };

  const RankOutput = (fromIndex: number, toIndex: number) => {
    setEvalTask((prev) => {
      if (!prev) return prev;

      const updatedOutputs = [...prev.models];
      const [movedItem] = updatedOutputs.splice(fromIndex, 1);
      updatedOutputs.splice(toIndex, 0, movedItem);

      const reRankedOutputs = updatedOutputs.map((output, index) => ({
        ...output,
        rank: index + 1,
      }));

      return {
        ...prev,
        models: reRankedOutputs,
      };
    });
  };

  const RateOutput = (index: number, rating: number) => {
    setEvalTask((prev) => {
      if (!prev) return prev;

      const updatedOutputs = prev.models.map((item, i) => {
        if (i === index) {
          return {
            ...item,
            rate: rating,
            rank: i + 1,
          };
        }
        return item;
      });

      return {
        ...prev,
        models: updatedOutputs,
      };
    });
  };

  const FetchBatchTasks = async (batch_detail: BatchDetailTypes) => {
    const res = await fetch(`/api/batches/tts/${batch_detail.batch_id}`);
    if (!res.ok) throw new Error("Failed to fetch batch data from server.");
    const batch = await res.json();
    return batch || ttsBatchTemplate;
  };

  const handleSelectedBatchUpdate = async (batch: BatchDetailTypes) => {
    setCurrentTaskIndex(0);
    if (batch.batch_name.toLowerCase().includes("realtime")) {
      handleResetEvalTask(modelsToEval);
    } else {
      const this_batchTasks = await FetchBatchTasks(batch);
      if (this_batchTasks?.tasks.length > 0) {
        setEvalTask({ ...this_batchTasks.tasks[0] });
        setBatchTasks([...this_batchTasks.tasks]);
        setReviewerComment(this_batchTasks.tasks[0]?.reviewer_comment ?? "");
        localStorage.setItem(
          "tts_active_batch",
          JSON.stringify({
            ...this_batchTasks,
            batch_id: batch.batch_id,
            dataset_type: batch.dataset_type,
            currentTaskIndex: 0,
          })
        );
      } else {
        handleResetEvalTask(modelsToEval);
      }
    }
  };

  const handlePreviousEvaluation = () => {
    if (currentTaskIndex > 0) {
      setError(null);
      const prevIndex = currentTaskIndex - 1;
      setCurrentTaskIndex(prevIndex);
      setEvalTask(batchTasks[prevIndex]);
      setReviewerComment(batchTasks[prevIndex]?.reviewer_comment ?? "");
      if (!IsRealtime()) {
        localStorage.setItem(
          "tts_active_batch",
          JSON.stringify({
            ...selectedBatchDetail,
            batch_id: selectedBatchDetail.batch_id,
            dataset_type: selectedBatchDetail.dataset_type,
            tasks: batchTasks,
            currentTaskIndex: prevIndex,
          })
        );
      }
    } else {
      setNotice({
        title: "First task",
        message: "You are already at the first task.",
        variant: "info",
      });
    }
  };

  const isThereChangeInActiveTask = () => {
    const storedBatch = JSON.parse(
      localStorage.getItem("tts_active_batch") || "[]"
    );
    const matchingTask = storedBatch?.tasks?.find(
      (task: EvalTaskTypes) => task.id === evalTask?.id
    );
    if (!matchingTask) return true;
    return JSON.stringify(evalTask) !== JSON.stringify(matchingTask);
  };

  const updateBatchDetail = async (batchDetail: BatchDetailTypes) => {
    const res = await fetch(
      `/api/batches-details/${selectedBatchDetail.batch_id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchDetail),
      }
    );
    if (!res.ok) throw new Error("Failed to update batch detail");
    setSelectedBatchDetail({ ...batchDetail });
    setBatchesDetails((prev) =>
      prev.map((batch) =>
        batch.batch_id === batchDetail.batch_id ? batchDetail : batch
      )
    );
  };

  const syncActiveBatchToStorage = (
    tasks: EvalTaskTypes[],
    taskIndex = currentTaskIndexRef.current
  ) => {
    if (IsRealtime()) return;
    localStorage.setItem(
      "tts_active_batch",
      JSON.stringify({
        ...selectedBatchDetail,
        batch_id: selectedBatchDetail.batch_id,
        dataset_type: selectedBatchDetail.dataset_type,
        tasks,
        currentTaskIndex: taskIndex,
      })
    );
  };

  const handleSaveTaskChanges = async (taskToSave?: EvalTaskTypes) => {
    const task = taskToSave ?? evalTask;
    if (!task) return null;
    const taskWithDuration = {
      ...task,
      started_at: getStartedAt(),
      completed_at: new Date().toISOString(),
      active_duration_ms: getActiveDurationMs(),
    };
    const res = await fetch(
      `/api/batches/${selectedBatchDetail.dataset_type}/${selectedBatchDetail.batch_id}/tasks/${task.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskWithDuration),
      }
    );
    if (!res.ok) throw new Error("Failed to save task changes");
  };

  const handleReferenceUpload = async (blob: Blob) => {
    if (!evalTask || IsRealtime()) return;
    setUploadingReference(true);
    try {
      const contentType = normalizeAudioContentType(blob.type || "audio/webm");
      const formData = new FormData();
      formData.append(
        "file",
        new File([blob], referenceAudioFilename(contentType), {
          type: contentType,
        })
      );

      const uploadRes = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const body = (await uploadRes.json()) as {
        file_id?: string;
        error?: string;
      };
      if (!uploadRes.ok || !body.file_id) {
        throw new Error(
          typeof body.error === "string" ? body.error : "Failed to upload audio."
        );
      }

      const updatedTask = { ...evalTask, reference: body.file_id };
      const updatedTasks = [...batchTasks];
      updatedTasks[currentTaskIndex] = updatedTask;

      setEvalTask(updatedTask);
      setBatchTasks(updatedTasks);

      await handleSaveTaskChanges(updatedTask);
      syncActiveBatchToStorage(updatedTasks);
    } catch (err) {
      setNotice({
        title: "Upload failed",
        message:
          err instanceof Error
            ? err.message
            : "Could not upload reference audio.",
        variant: "error",
      });
      throw err;
    } finally {
      setUploadingReference(false);
    }
  };

  const isAnnotationMode =
    !IsRealtime() &&
    evalTask != null &&
    selectedBatchDetail.workflow === "annotation";

  const handleAnnotationTaskPersist = async (task: EvalTaskTypes) => {
    const index = currentTaskIndexRef.current;
    const tasks = batchTasksRef.current;
    if (index < 0 || index >= tasks.length) return;

    const updatedTasks = [...tasks];
    updatedTasks[index] = task;
    batchTasksRef.current = updatedTasks;
    setBatchTasks(updatedTasks);
    setEvalTask(task);
    await handleSaveTaskChanges(task);
    syncActiveBatchToStorage(updatedTasks, index);
  };

  const handleAnnotationNavigate = (index: number) => {
    const tasks = batchTasksRef.current;
    const task = tasks[index];
    if (!task) return;

    setCurrentTaskIndex(index);
    currentTaskIndexRef.current = index;
    setEvalTask({ ...task });
    setReviewerComment(task.reviewer_comment ?? "");
    syncActiveBatchToStorage(tasks, index);
  };

  const handleSegmentUpload = async (blob: Blob, taskIndex: number) => {
    if (IsRealtime()) return;

    const contentType = normalizeAudioContentType(blob.type || "audio/webm");
    const formData = new FormData();
    formData.append(
      "file",
      new File([blob], referenceAudioFilename(contentType), {
        type: contentType,
      })
    );

    const uploadRes = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });
    const body = (await uploadRes.json()) as {
      file_id?: string;
      error?: string;
    };
    if (!uploadRes.ok || !body.file_id) {
      throw new Error(
        typeof body.error === "string" ? body.error : "Failed to upload audio."
      );
    }

    const prev = batchTasksRef.current;
    if (taskIndex < 0 || taskIndex >= prev.length) {
      throw new Error(`Invalid segment index ${taskIndex + 1} for upload.`);
    }

    const existing = prev[taskIndex];
    const base =
      taskIndex === currentTaskIndexRef.current &&
      evalTaskRef.current?.id === existing?.id
        ? evalTaskRef.current
        : existing;

    const savedTask: EvalTaskTypes = {
      ...base,
      reference: body.file_id,
    };
    const nextTasks = [...prev];
    nextTasks[taskIndex] = savedTask;

    // Keep ref in sync immediately so later queued segment uploads see prior references.
    batchTasksRef.current = nextTasks;
    setBatchTasks(nextTasks);
    setEvalTask((current) =>
      current?.id === savedTask.id
        ? { ...current, reference: savedTask.reference }
        : current
    );
    syncActiveBatchToStorage(nextTasks, taskIndex);

    await handleSaveTaskChanges(savedTask);
    await updateBatchDetail({
      ...selectedBatchDetail,
      annotated_tasks: nextTasks.filter((t) =>
        Boolean(t.reference?.trim())
      ).length,
    });
  };

  const handleSubmitEvaluation = async () => {
    if (!evalTask) return null;

    const taskValidation = validateEvaluationTask(evalTask);
    setError(taskValidation);
    if (!taskValidation.isValid) return null;

    if (!IsRealtime()) {
      const updatedTasks: EvalTaskTypes[] = [...batchTasks];
      updatedTasks[currentTaskIndex] = {
        ...evalTask,
        reference: evalTask.reference?.trim(),
      };

      setBatchTasks(updatedTasks);

      if (isThereChangeInActiveTask()) {
        try {
          await handleSaveTaskChanges(updatedTasks[currentTaskIndex]);
          const evaluatedTasks = updatedTasks.filter((item) =>
            item.models.some((m) => m.rate > 0 && m.rank > 0)
          );
          await updateBatchDetail({
            ...selectedBatchDetail,
            annotated_tasks: evaluatedTasks.length,
          });
        } catch {
          setNotice({
            title: "Save failed",
            message: "Failed to save evaluation. Please try again.",
            variant: "error",
          });
          return;
        }
      }

      const nextIndex = currentTaskIndex + 1;
      if (nextIndex < batchTasks.length) {
        const nextTask = updatedTasks[nextIndex];
        setEvalTask(nextTask);
        setCurrentTaskIndex(nextIndex);
        setReviewerComment(nextTask?.reviewer_comment ?? "");
        localStorage.setItem(
          "tts_active_batch",
          JSON.stringify({
            ...selectedBatchDetail,
            batch_id: selectedBatchDetail.batch_id,
            dataset_type: selectedBatchDetail.dataset_type,
            tasks: updatedTasks,
            currentTaskIndex: nextIndex,
          })
        );
      } else {
        setCurrentTaskIndex(0);
        setEvalTask(updatedTasks[0]);
        setReviewerComment(updatedTasks[0]?.reviewer_comment ?? "");
        setNotice({
          title: "End of batch",
          message: `End of <${selectedBatchDetail.batch_name}> TTS evaluation tasks! Back to first task.`,
          variant: "info",
        });
        localStorage.setItem(
          "tts_active_batch",
          JSON.stringify({
            ...selectedBatchDetail,
            batch_id: selectedBatchDetail.batch_id,
            dataset_type: selectedBatchDetail.dataset_type,
            tasks: updatedTasks,
            currentTaskIndex: 0,
          })
        );
      }
    } else if (evalTask?.input) {
      setNotice({
        title: "Coming soon",
        message:
          "Realtime synthesis is coming soon. For now, this is only for dataset evaluation.",
        variant: "info",
      });
      handleResetEvalTask(modelsToEval);
    }
  };

  const realtimeSynthesize = () => {
    if (!evalTask?.input.trim()) return;
    setNotice({
      title: "Coming soon",
      message:
        "Realtime synthesis is coming soon. For now, this is only for dataset evaluation.",
      variant: "info",
    });
  };

  useEffect(() => {
    const fetchTTSBatchDetails = async () => {
      setIsLoading(true);
      try {
        if (user?.username) {
          const res = await fetch(
            `/api/batches-details?dataset_type=tts&username=${user.username}`
          );
          if (!res.ok) throw new Error("Failed to fetch batch details");
          const data: BatchDetailTypes[] = await res.json();

          if (data.length > 0) {
            setBatchesDetails((prev) => [...data, ...prev]);

            const active_batch = localStorage.getItem("tts_active_batch");
            if (active_batch) {
              try {
                const batch_json = JSON.parse(active_batch) as ASRBatchTasksTypes & {
                  currentTaskIndex?: number;
                };
                const existingSelectedBatch = data.find(
                  (item) => item.batch_id === batch_json.batch_id
                );
                if (existingSelectedBatch) {
                  const freshBatch = await FetchBatchTasks(existingSelectedBatch);
                  const tasks = Array.isArray(freshBatch?.tasks)
                    ? freshBatch.tasks
                    : [];
                  if (tasks.length > 0) {
                    const idx = Math.min(
                      Math.max(0, batch_json.currentTaskIndex ?? 0),
                      tasks.length - 1
                    );
                    setSelectedBatchDetail(existingSelectedBatch);
                    setBatchTasks([...tasks]);
                    setCurrentTaskIndex(idx);
                    setEvalTask({ ...tasks[idx] });
                    setReviewerComment(tasks[idx]?.reviewer_comment ?? "");
                    localStorage.setItem(
                      "tts_active_batch",
                      JSON.stringify({
                        ...freshBatch,
                        batch_id: existingSelectedBatch.batch_id,
                        dataset_type: existingSelectedBatch.dataset_type,
                        tasks,
                        currentTaskIndex: idx,
                      })
                    );
                    return;
                  }
                }
              } catch {
                // fall through
              }
            }

            const firstBatch = data[0];
            setSelectedBatchDetail(firstBatch);
            const this_batchTasks = await FetchBatchTasks(firstBatch);
            if (this_batchTasks?.tasks?.length > 0) {
              setEvalTask({ ...this_batchTasks.tasks[0] });
              setBatchTasks([...this_batchTasks.tasks]);
              setReviewerComment(
                this_batchTasks.tasks[0]?.reviewer_comment ?? ""
              );
              localStorage.setItem(
                "tts_active_batch",
                JSON.stringify({
                  ...this_batchTasks,
                  batch_id: firstBatch.batch_id,
                  dataset_type: firstBatch.dataset_type,
                  currentTaskIndex: 0,
                })
              );
            }
            return;
          }
        }

        setBatchesDetails([ttsRealtimeBatch]);
        setSelectedBatchDetail({ ...ttsRealtimeBatch });
        handleResetEvalTask(2);
      } catch (err) {
        console.error("Error fetching TTS batch details:", err);
      } finally {
        setIsLoading(false);
      }
    };

    handleResetEvalTask(2);
    fetchTTSBatchDetails();
  }, [user?.username]);

  useEffect(() => {
  }, [evalTask?.id]);

  return (
    <Container
      className={
        isAnnotationMode
          ? "!p-3 sm:!p-6 md:!px-12 md:!py-8 flex flex-col min-h-[100dvh] sm:min-h-[calc(100vh-1.5rem)]"
          : undefined
      }
    >
      <div
        className={`w-full max-w-6xl ${isAnnotationMode ? "flex flex-col flex-1 min-h-0" : "space-y-5"}`}
      >
        <div
          className={`w-full flex gap-2 shrink-0 ${
            isAnnotationMode
              ? "justify-end"
              : "flex-wrap sm:flex-nowrap justify-between items-center"
          }`}
        >
          {!isAnnotationMode && (
            <SelectOption
              id="from-language"
              label="Language"
              name="source_language"
              value={selectedBatchDetail.source_language.iso_639_3}
              options={
                IsRealtime() ? languages : [selectedBatchDetail.source_language]
              }
              onChange={(selectedLang) =>
                setSelectedBatchDetail((prev) => ({
                  ...prev,
                  source_language: selectedLang,
                  target_language: selectedLang,
                }))
              }
              labelClass="absolute md:left-3 border-r-2 md:pr-2.5 opacity-50"
              selectClass="md:pl-24"
              disabled={!IsRealtime()}
            />
          )}

          {IsRealtime() && (
            <SelectTransparent
              id="models_to_eval"
              label="Models"
              name="modelsToEval"
              value={modelsToEval}
              optionsValues={Array.from(
                { length: ttsModels.length },
                (_, i) => i + 2
              )}
              onChange={(e) => {
                const value = parseInt(String(e.target.value), 10);
                setModelsToEval(value);
                handleResetEvalTask(value);
                setCurrentTaskIndex(0);
              }}
              labelClass="absolute left-3 border-r-2 pr-2.5"
              selectClass="p-[11px] pl-20"
            />
          )}

          {user?.username && (
            <SelectTransparent
              id="selected-dataset"
              label="Data"
              name="selectedBatchDetail"
              value={selectedBatchDetail.batch_id}
              optionsValues={[
                ...new Set(batchesDetails.map((item) => item.batch_id)),
              ]}
              optionsLabels={[
                ...new Set(batchesDetails.map((item) => item.batch_name)),
              ]}
              searchable
              onChange={async (e) => {
                setIsLoading(true);
                setError(null);
                const batchDetails = batchesDetails.find(
                  (item) => item.batch_id === e.target.value
                );
                try {
                  if (batchDetails) {
                    setSelectedBatchDetail(batchDetails);
                    await handleSelectedBatchUpdate(batchDetails);
                  } else {
                    setSelectedBatchDetail(ttsRealtimeBatch);
                  }
                } finally {
                  setIsLoading(false);
                }
              }}
              labelClass="absolute left-3 border-r-2 pr-2"
              selectClass="pl-14"
              className={
                isAnnotationMode
                  ? "w-full sm:w-auto sm:min-w-[12rem] sm:max-w-xs ml-0 sm:ml-auto shrink-0"
                  : undefined
              }
            />
          )}
        </div>

        {isLoading || !evalTask ? (
          <div className="w-full py-12 text-center text-neutral-500">
            Loading...
          </div>
        ) : isAnnotationMode ? (
          <div className="flex flex-col flex-1 w-full min-h-0">
            <TTSAnnotationPanel
              evalTask={evalTask}
              batchTasks={batchTasks}
              currentTaskIndex={currentTaskIndex}
              onTaskPersist={handleAnnotationTaskPersist}
              onNavigate={handleAnnotationNavigate}
              onSegmentUpload={handleSegmentUpload}
              onNotice={(title, message, variant) =>
                setNotice({ title, message, variant })
              }
            />
          </div>
        ) : (
          <div className="w-full block space-y-5 md:flex justify-between space-x-5">
            <TranslationInputTextarea
              name="input"
              isHorizontal={false}
              value={evalTask.input}
              maxLength={2500}
              disabled={!IsRealtime()}
              onChange={(e) =>
                setEvalTask((prev) => {
                  if (!prev) return prev;
                  return { ...prev, input: e.target.value };
                })
              }
              className="md:w-1/2"
              translate={IsRealtime() ? realtimeSynthesize : undefined}
              actionLabel="Synthesize"
              actionLoadingLabel="Synthesizing"
              loading={false}
            />

            <div className="w-full md:w-1/2 space-y-3">
              {(evalTask.models ?? []).map(
                (task, i) => {
                  const index = IsRealtime()
                    ? i
                    : (() => {
                        const modelIndex = evalTask.models.findIndex(
                          (m) =>
                            m.model === task.model && m.output === task.output
                        );
                        return modelIndex >= 0 ? modelIndex : i;
                      })();
                  return (
                    <AudioCard
                      key={`${evalTask.id}-${task.model}-${index}`}
                      type="output"
                      index={index}
                      task={task}
                      onClickRankUp={() => RankOutput(index, index - 1)}
                      onClickRankDown={() => RankOutput(index, index + 1)}
                      onClickRate={RateOutput}
                      error={error}
                      isLastItem={index === evalTask.models.length - 1}
                      readOnly={isReviewerMode}
                      rating_guideline={
                        selectedBatchDetail.rating_guideline ?? undefined
                      }
                    />
                  );
                }
              )}

              <div
                className={`transition-all duration-600 ease-in-out overflow-hidden ${
                  showReference
                    ? "max-h-[600px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <AudioCard
                  key={`reference-${evalTask.id}-${evalTask.reference ?? "new"}`}
                  type="input"
                  variant="primary"
                  input_url={evalTask.reference}
                  loading={uploadingReference}
                  onUpload={handleReferenceUpload}
                  uploadButtonText="Save reference"
                />
              </div>

              {isReviewerMode ? (
                <ReviewerPanel
                  evalTask={evalTask}
                  reviewerComment={reviewerComment}
                  setReviewerComment={setReviewerComment}
                  savingComment={savingComment}
                  onSaveComment={handleSaveReviewerComment}
                  onNext={handleReviewerNext}
                  onPrev={handleReviewerPrev}
                  currentTaskIndex={currentTaskIndex}
                  totalTasks={batchTasks.length}
                  referencePlaceholder="Reference synthesis notes"
                />
              ) : (
                <>
                  <DomainsList
                    domains={selectedBatchDetail.domains ?? undefined}
                    selectedDomains={evalTask.domain ?? []}
                    toggleDomainSelection={(name) =>
                      setEvalTask((prev) => {
                        if (!prev) return prev;
                        const current = prev.domain ?? [];
                        const isSelected = current.includes(name);
                        return {
                          ...prev,
                          domain: isSelected
                            ? current.filter((d) => d !== name)
                            : [...current, name],
                        };
                      })
                    }
                  />

                  <ReviewerCommentDisplay
                    comment={evalTask.reviewer_comment ?? ""}
                  />

                  <div className="flex items-center justify-between space-x-2 font-mono">
                    <div className="w-fit flex space-x-2 items-center">
                      <Button
                        variant="primary"
                        minimal
                        size="sm"
                        onClick={() => setShowReference(!showReference)}
                        className="!font-semibold"
                      >
                        {showReference ? (
                          <>
                            <Minus className="size-4" /> Hide
                          </>
                        ) : (
                          <>
                            <Plus className="size-4" /> Add
                          </>
                        )}{" "}
                        Reference
                      </Button>
                    </div>

                    <div className="flex items-center justify-end space-x-2 text-right">
                      {currentTaskIndex > 0 && (
                        <Button
                          onClick={handlePreviousEvaluation}
                          outline
                          size="sm"
                          text="Prev"
                          className="!px-8 !text-current !font-semibold"
                        />
                      )}

                      {!IsRealtime() && (
                        <span className="text-sm font-bold">
                          {currentTaskIndex + 1}/{batchTasks.length}
                        </span>
                      )}

                      <Button
                        onClick={handleSubmitEvaluation}
                        outline
                        size="sm"
                        text={
                          IsRealtime()
                            ? "Submit"
                            : isThereChangeInActiveTask()
                              ? "Save & Next"
                              : "Next"
                        }
                        className="!px-8 !text-current !font-semibold"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!notice}
        setIsOpen={(open) => {
          if (open) return;
          setNotice(null);
        }}
        className="!max-w-md"
      >
        <div className="p-2">
          <h3 className="text-lg font-semibold mb-2">
            {notice?.title ?? "Notice"}
          </h3>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
            {notice?.message ?? ""}
          </p>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setNotice(null)}>
              OK
            </Button>
          </div>
        </div>
      </Modal>
    </Container>
  );
}
