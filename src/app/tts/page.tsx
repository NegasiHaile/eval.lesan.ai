"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import TeleprompterDisplay from "@/components/inputs/TeleprompterDisplay";
import ReferenceVoiceArea from "@/components/inputs/ReferenceVoiceArea";
import SelectOption from "@/components/inputs/SelectOption";
import SelectTransparent from "@/components/inputs/SelectTransparent";
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
import { referenceAudioFilename } from "@/helpers/reference_audio_filename";
import { normalizeAudioContentType } from "@/constants/transcription";
import {
  ASRBatchTasksTypes,
  BatchDetailTypes,
  EvalTaskTypes,
} from "@/types/data";
import { Plus, Minus } from "lucide-react";

const SEGMENT_SEPARATOR = "\n\n";
const ADVANCE_DELAY_MS = 1000;

function segmentsToFullText(tasks: EvalTaskTypes[]): string {
  return tasks.map((t) => t.input).join(SEGMENT_SEPARATOR);
}

function fullTextToSegments(
  fullText: string,
  prevTasks: EvalTaskTypes[]
): EvalTaskTypes[] {
  const parts = fullText
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (parts.length === 0) {
    const template = prevTasks[0];
    if (!template) return prevTasks;
    return [{ ...template, input: "" }];
  }

  const template = prevTasks[0];
  return parts.map((input, i) => {
    const prev = prevTasks[i];
    if (prev) return { ...prev, input };
    if (!template) return { id: String(i + 1), input, models: [], reference: "" };
    return {
      ...template,
      id: String(i + 1),
      input,
      reference: "",
    };
  });
}

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showReference, setShowReference] = useState(false);
  const [uploadingReference, setUploadingReference] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAdvance = useCallback(() => {
    if (advanceRef.current) clearTimeout(advanceRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    advanceRef.current = null;
    countdownRef.current = null;
  }, []);

  useEffect(() => () => clearAdvance(), [clearAdvance]);

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

  const FetchBatchTasks = async (batch_detail: BatchDetailTypes) => {
    const res = await fetch(`/api/batches/tts/${batch_detail.batch_id}`);
    if (!res.ok) throw new Error("Failed to fetch batch data from server.");
    const batch = await res.json();
    return batch || ttsBatchTemplate;
  };

  const handleSelectedBatchUpdate = async (batch: BatchDetailTypes) => {
    handleResetEvalTask(2);
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

  const syncActiveBatchToStorage = (tasks: EvalTaskTypes[]) => {
    if (IsRealtime()) return;
    localStorage.setItem(
      "tts_active_batch",
      JSON.stringify({
        ...selectedBatchDetail,
        batch_id: selectedBatchDetail.batch_id,
        dataset_type: selectedBatchDetail.dataset_type,
        tasks,
        currentTaskIndex,
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
    if (!evalTask) return;
    if (IsRealtime()) {
      setNotice({
        title: "Not available",
        message:
          "Reference audio upload only works on dataset batches. Select a TTS batch from the Data dropdown.",
        variant: "info",
      });
      throw new Error("Reference upload is not available in realtime mode.");
    }
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

  const persistCurrentTask = async (): Promise<EvalTaskTypes[] | null> => {
    if (!evalTask) return null;

    const taskValidation = validateEvaluationTask(evalTask, {
      optionalModelRatings: true,
    });
    if (!taskValidation.isValid) {
      if (taskValidation.message) {
        setNotice({
          title: "Validation",
          message: taskValidation.message,
          variant: "error",
        });
      }
      return null;
    }

    const updatedTasks: EvalTaskTypes[] = [...batchTasks];
    updatedTasks[currentTaskIndex] = {
      ...evalTask,
      reference: evalTask.reference?.trim(),
    };

    setBatchTasks(updatedTasks);

    if (!isThereChangeInActiveTask()) return updatedTasks;

    try {
      await handleSaveTaskChanges(updatedTasks[currentTaskIndex]);
      const evaluatedTasks = updatedTasks.filter((item) =>
        Boolean(item.reference?.trim())
      );
      await updateBatchDetail({
        ...selectedBatchDetail,
        annotated_tasks: evaluatedTasks.length,
      });
      syncActiveBatchToStorage(updatedTasks);
      return updatedTasks;
    } catch {
      setNotice({
        title: "Save failed",
        message: "Failed to save evaluation. Please try again.",
        variant: "error",
      });
      return null;
    }
  };

  const persistAndAdvanceTask = async () => {
    const updatedTasks = await persistCurrentTask();
    if (!updatedTasks) return;

    const nextIndex = currentTaskIndex + 1;
    if (nextIndex >= updatedTasks.length) return;

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
  };

  const startAdvanceCountdown = (onComplete: () => void) => {
    clearAdvance();
    setIsAdvancing(true);
    setSecondsLeft(ADVANCE_DELAY_MS / 1000);

    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    advanceRef.current = setTimeout(() => {
      clearAdvance();
      setIsAdvancing(false);
      setSecondsLeft(0);
      onComplete();
    }, ADVANCE_DELAY_MS);
  };

  const handleSubmitEvaluation = () => {
    if (!evalTask || isAdvancing) return;

    if (IsRealtime()) {
      if (evalTask.input) {
        setNotice({
          title: "Coming soon",
          message:
            "Realtime synthesis is coming soon. For now, this is only for dataset evaluation.",
          variant: "info",
        });
        handleResetEvalTask(modelsToEval);
      }
      return;
    }

    if (currentTaskIndex >= batchTasks.length - 1) return;
    startAdvanceCountdown(() => void persistAndAdvanceTask());
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
    if (evalTask?.reference?.trim()) {
      setShowReference(true);
    }
  }, [evalTask?.id, evalTask?.reference]);

  const fullBatchText = segmentsToFullText(batchTasks);
  const isLastTask = currentTaskIndex >= batchTasks.length - 1;
  const nextButtonLabel = (() => {
    if (IsRealtime()) return "Submit";
    if (isAdvancing) {
      const base = isThereChangeInActiveTask() ? "Save & Next" : "Next";
      return `${base} (${secondsLeft}s)`;
    }
    if (isThereChangeInActiveTask()) return "Save & Next";
    return "Next";
  })();
  const prevButtonLabel = isAdvancing ? `Prev (${secondsLeft}s)` : "Prev";

  const handleFullTextChange = (fullTextValue: string) => {
    const newTasks = fullTextToSegments(fullTextValue, batchTasks);
    const nextIndex = Math.min(currentTaskIndex, Math.max(0, newTasks.length - 1));
    setBatchTasks(newTasks);
    setCurrentTaskIndex(nextIndex);
    setEvalTask(newTasks[nextIndex] ?? null);
  };

  return (
    <Container className="!w-full !items-start !p-0 md:!py-8 md:!pr-10 md:!pl-4">
      <div className="w-full space-y-4 md:space-y-5">
        <div className="w-full flex flex-wrap sm:flex-nowrap justify-between items-center gap-2">
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
                const batchDetails = batchesDetails.find(
                  (item) => item.batch_id === e.target.value
                );
                try {
                  if (batchDetails) {
                    setSelectedBatchDetail(batchDetails);
                    setShowReference(false);
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
            />
          )}
        </div>

        {isLoading || !evalTask ? (
          <div className="w-full py-12 text-center text-neutral-500">
            Loading...
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
            <textarea
              value={fullBatchText}
              onChange={(e) => handleFullTextChange(e.target.value)}
              readOnly={!IsRealtime()}
              disabled={isAdvancing}
              maxLength={2500 * Math.max(batchTasks.length, 1)}
              className="w-full md:w-[36%] lg:w-[32%] shrink-0 p-3 min-h-[200px] md:min-h-[420px] rounded-lg text-sm bg-neutral-50 border border-neutral-200 dark:bg-neutral-800/50 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 resize-y read-only:opacity-90 read-only:cursor-default"
              aria-label="Batch script"
            />

            <div className="w-full md:flex-1 min-w-0 space-y-4">
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 overflow-hidden">
                <TeleprompterDisplay
                  text={evalTask.input}
                  isCountingDown={isAdvancing}
                  secondsLeft={secondsLeft}
                />
              </div>

              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  showReference
                    ? "max-h-[320px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 overflow-hidden">
                  <ReferenceVoiceArea
                    key={`reference-${evalTask.id}-${evalTask.reference ?? "new"}`}
                    value={evalTask.reference}
                    onSaveRecording={handleReferenceUpload}
                    loading={uploadingReference}
                    disabled={IsRealtime()}
                  />
                </div>
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
                        type="button"
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
                          type="button"
                          onClick={handlePreviousEvaluation}
                          outline
                          size="sm"
                          text={prevButtonLabel}
                          disabled={isAdvancing || uploadingReference}
                          className="!px-8 !text-current !font-semibold"
                        />
                      )}

                      {!IsRealtime() && (
                        <span className="text-sm font-bold">
                          {currentTaskIndex + 1}/{batchTasks.length}
                        </span>
                      )}

                      {!IsRealtime() && isLastTask && isThereChangeInActiveTask() && (
                        <Button
                          type="button"
                          onClick={() => void persistCurrentTask()}
                          outline
                          size="sm"
                          text="Save"
                          disabled={isAdvancing || uploadingReference}
                          className="!px-8 !text-current !font-semibold"
                        />
                      )}

                      {(!IsRealtime() ? !isLastTask : true) && (
                        <Button
                          type="button"
                          onClick={handleSubmitEvaluation}
                          outline
                          size="sm"
                          text={nextButtonLabel}
                          disabled={isAdvancing || uploadingReference}
                          className="!px-8 !text-current !font-semibold"
                        />
                      )}
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
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setNotice(null)}
            >
              OK
            </Button>
          </div>
        </div>
      </Modal>
    </Container>
  );
}
