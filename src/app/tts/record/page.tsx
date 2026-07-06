"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import DomainsList from "@/components/DomainsList";
import TeleprompterDisplay from "@/components/inputs/TeleprompterDisplay";
import ReferenceVoiceArea from "@/components/inputs/ReferenceVoiceArea";
import SelectTransparent from "@/components/inputs/SelectTransparent";
import Container from "@/components/utils/Container";
import Button from "@/components/utils/Button";
import Modal from "@/components/utils/Modal";
import { useUser } from "@/context/UserContext";
import { usePresence } from "@/hooks/usePresence";
import { useTaskDuration } from "@/hooks/useTaskDuration";
import { ttsBatchTemplate } from "@/constants/initial_values";
import { referenceAudioFilename } from "@/helpers/reference_audio_filename";
import { normalizeAudioContentType } from "@/constants/transcription";
import {
  ASRBatchTasksTypes,
  BatchDetailTypes,
  EvalTaskTypes,
} from "@/types/data";

const ADVANCE_DELAY_MS = 1000;
/** Persists in-progress batch + task index across reloads on /tts/record */
const STORAGE_KEY = "tts_record_active_batch";

export default function TTSRecordPage() {
  const { user } = useUser();
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
    variant?: "info" | "success" | "error";
  } | null>(null);

  const [batchesDetails, setBatchesDetails] = useState<BatchDetailTypes[]>([]);
  const [selectedBatchDetail, setSelectedBatchDetail] =
    useState<BatchDetailTypes | null>(null);
  const [batchTasks, setBatchTasks] = useState<EvalTaskTypes[]>([]);
  const [evalTask, setEvalTask] = useState<EvalTaskTypes | null>(null);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingReference, setUploadingReference] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
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

  usePresence(user, selectedBatchDetail?.batch_id);
  const { getStartedAt, getActiveDurationMs } = useTaskDuration(evalTask?.id);

  const fetchBatchTasks = async (batch: BatchDetailTypes) => {
    const res = await fetch(`/api/batches/tts/${batch.batch_id}`);
    if (!res.ok) throw new Error("Failed to fetch batch data from server.");
    const data = await res.json();
    return data || ttsBatchTemplate;
  };

  const syncActiveBatchToStorage = (
    batch: BatchDetailTypes,
    tasks: EvalTaskTypes[],
    taskIndex: number
  ) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        batch_id: batch.batch_id,
        dataset_type: batch.dataset_type,
        tasks,
        currentTaskIndex: taskIndex,
      })
    );
  };

  const updateBatchDetail = async (batchDetail: BatchDetailTypes) => {
    const res = await fetch(
      `/api/batches-details/${batchDetail.batch_id}`,
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

  const isThereChangeInActiveTask = () => {
    if (!evalTask) return false;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return true;
      const parsed = JSON.parse(stored) as ASRBatchTasksTypes & {
        currentTaskIndex?: number;
      };
      const savedTask = parsed.tasks?.[currentTaskIndex];
      if (!savedTask) return true;
      return JSON.stringify(evalTask) !== JSON.stringify(savedTask);
    } catch {
      return true;
    }
  };

  const persistCurrentTask = async (): Promise<{
    ok: boolean;
    tasks: EvalTaskTypes[];
  } | null> => {
    if (!evalTask || !selectedBatchDetail) return null;

    if (!isThereChangeInActiveTask()) {
      return { ok: true, tasks: batchTasks };
    }

    setSavingTask(true);
    try {
      const taskToSave = {
        ...evalTask,
        reference: evalTask.reference?.trim(),
      };
      await handleSaveTaskChanges(taskToSave);

      const updatedTasks = [...batchTasks];
      updatedTasks[currentTaskIndex] = taskToSave;
      setBatchTasks(updatedTasks);
      setEvalTask(taskToSave);
      syncActiveBatchToStorage(
        selectedBatchDetail,
        updatedTasks,
        currentTaskIndex
      );

      const evaluatedTasks = updatedTasks.filter((item) =>
        Boolean(item.reference?.trim())
      );
      await updateBatchDetail({
        ...selectedBatchDetail,
        annotated_tasks: evaluatedTasks.length,
      });
      return { ok: true, tasks: updatedTasks };
    } catch {
      setNotice({
        title: "Save failed",
        message: "Failed to save changes. Please try again.",
        variant: "error",
      });
      return { ok: false, tasks: batchTasks };
    } finally {
      setSavingTask(false);
    }
  };

  const handleSaveTaskChanges = async (taskToSave: EvalTaskTypes) => {
    if (!selectedBatchDetail) return;
    const taskWithDuration = {
      ...taskToSave,
      started_at: getStartedAt(),
      completed_at: new Date().toISOString(),
      active_duration_ms: getActiveDurationMs(),
    };
    const res = await fetch(
      `/api/batches/${selectedBatchDetail.dataset_type}/${selectedBatchDetail.batch_id}/tasks/${taskToSave.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskWithDuration),
      }
    );
    if (!res.ok) throw new Error("Failed to save task changes");
  };

  const handleReferenceUpload = async (blob: Blob) => {
    if (!evalTask || !selectedBatchDetail) return;
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
      syncActiveBatchToStorage(selectedBatchDetail, updatedTasks, currentTaskIndex);

      const evaluatedTasks = updatedTasks.filter((item) =>
        Boolean(item.reference?.trim())
      );
      await updateBatchDetail({
        ...selectedBatchDetail,
        annotated_tasks: evaluatedTasks.length,
      });
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

  const loadBatch = async (batch: BatchDetailTypes, taskIndex = 0) => {
    const batchData = await fetchBatchTasks(batch);
    const tasks = Array.isArray(batchData?.tasks) ? batchData.tasks : [];
    if (tasks.length === 0) {
      setSelectedBatchDetail(batch);
      setBatchTasks([]);
      setEvalTask(null);
      setCurrentTaskIndex(0);
      return;
    }

    const idx = Math.min(Math.max(0, taskIndex), tasks.length - 1);
    setSelectedBatchDetail(batch);
    setBatchTasks([...tasks]);
    setCurrentTaskIndex(idx);
    setEvalTask({ ...tasks[idx] });
    syncActiveBatchToStorage(batch, tasks, idx);
  };

  const handleSelectedBatchUpdate = async (batch: BatchDetailTypes) => {
    clearAdvance();
    setIsAdvancing(false);
    setSecondsLeft(0);
    setIsLoading(true);
    try {
      await loadBatch(batch, 0);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    if (currentTaskIndex <= 0) {
      setNotice({
        title: "First task",
        message: "You are already at the first task.",
        variant: "info",
      });
      return;
    }
    const prevIndex = currentTaskIndex - 1;
    if (!selectedBatchDetail) return;
    setCurrentTaskIndex(prevIndex);
    setEvalTask(batchTasks[prevIndex]);
    syncActiveBatchToStorage(selectedBatchDetail, batchTasks, prevIndex);
  };

  const advanceToNext = async () => {
    if (!evalTask || !selectedBatchDetail) return;

    const result = await persistCurrentTask();
    if (!result?.ok) return;

    const nextIndex = currentTaskIndex + 1;
    if (nextIndex >= result.tasks.length) return;

    setCurrentTaskIndex(nextIndex);
    setEvalTask(result.tasks[nextIndex]);
    syncActiveBatchToStorage(
      selectedBatchDetail,
      result.tasks,
      nextIndex
    );
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        if (!user?.username) {
          setBatchesDetails([]);
          setSelectedBatchDetail(null);
          setBatchTasks([]);
          setEvalTask(null);
          return;
        }

        const res = await fetch(
          `/api/batches-details?dataset_type=tts&username=${user.username}`
        );
        if (!res.ok) throw new Error("Failed to fetch batch details");
        const data: BatchDetailTypes[] = await res.json();
        setBatchesDetails(data);

        if (data.length === 0) {
          setSelectedBatchDetail(null);
          setBatchTasks([]);
          setEvalTask(null);
          return;
        }

        const activeStored = localStorage.getItem(STORAGE_KEY);
        if (activeStored) {
          try {
            const stored = JSON.parse(activeStored) as ASRBatchTasksTypes & {
              currentTaskIndex?: number;
            };
            if (stored.batch_id) {
              const match = data.find((b) => b.batch_id === stored.batch_id);
              if (match) {
                await loadBatch(match, stored.currentTaskIndex ?? 0);
                return;
              }
            }
          } catch {
            // fall through
          }
        }

        await loadBatch(data[0], 0);
      } catch (err) {
        console.error("Error loading TTS record batches:", err);
        setNotice({
          title: "Load failed",
          message: "Could not load TTS batches. Please try again.",
          variant: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    void init();
  }, [user?.username]);

  const isLastTask = currentTaskIndex >= batchTasks.length - 1;
  const segmentLabel = `${currentTaskIndex + 1} / ${batchTasks.length}`;

  const toggleDomainSelection = (name: string) => {
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
    });
  };

  const handleSave = () => {
    void persistCurrentTask();
  };

  const handleNext = () => {
    if (!evalTask || isAdvancing || currentTaskIndex >= batchTasks.length - 1) return;

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
      void advanceToNext();
    }, ADVANCE_DELAY_MS);
  };

  const hasUnsavedChanges = isThereChangeInActiveTask();
  const navDisabled = isAdvancing || uploadingReference || savingTask;

  return (
    <Container className="!w-full !items-start !p-0 md:!py-8 md:!pr-10 md:!pl-4">
      <div className="w-full space-y-4 md:space-y-5">
        <div className="w-full flex flex-wrap items-center justify-end gap-2">
          {user?.username && batchesDetails.length > 0 && (
            <SelectTransparent
              id="tts-record-dataset"
              label="Data"
              name="selectedBatchDetail"
              value={selectedBatchDetail?.batch_id ?? ""}
              optionsValues={batchesDetails.map((item) => item.batch_id)}
              optionsLabels={batchesDetails.map((item) => item.batch_name)}
              searchable
              className="!w-auto shrink-0"
              onChange={async (e) => {
                const batch = batchesDetails.find(
                  (item) => item.batch_id === e.target.value
                );
                if (batch) await handleSelectedBatchUpdate(batch);
              }}
              labelClass="absolute left-2.5 border-r pr-2 text-xs opacity-50"
              selectClass="!pl-[3.25rem] !pr-2 !py-1 !h-8 !min-w-0 !text-xs !max-w-[220px]"
            />
          )}
        </div>

        {isLoading ? (
          <div className="w-full py-12 text-center text-neutral-500">
            Loading...
          </div>
        ) : !user?.username ? (
          <div className="w-full py-12 text-center text-neutral-500">
            Sign in to collect TTS reference recordings for your assigned batches.
          </div>
        ) : batchesDetails.length === 0 ? (
          <div className="w-full py-12 text-center text-neutral-500">
            No TTS batches are assigned to you yet.
          </div>
        ) : !evalTask ? (
          <div className="w-full py-12 text-center text-neutral-500">
            This batch has no tasks.
          </div>
        ) : (
          <div className="w-full max-w-4xl mx-auto space-y-4">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 overflow-hidden">
              <TeleprompterDisplay
                text={evalTask.input}
                isCountingDown={isAdvancing}
                secondsLeft={secondsLeft}
              />
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 overflow-hidden">
              <ReferenceVoiceArea
                key={`reference-${evalTask.id}-${evalTask.reference ?? "new"}`}
                value={evalTask.reference}
                onSaveRecording={handleReferenceUpload}
                loading={uploadingReference}
                disabled={isAdvancing}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 px-1">
                Domains{" "}
                <span className="opacity-70">(optional)</span>
              </p>
              <DomainsList
                domains={selectedBatchDetail?.domains ?? undefined}
                selectedDomains={evalTask.domain ?? []}
                toggleDomainSelection={toggleDomainSelection}
              />
            </div>

            <div className="flex items-center justify-center gap-2 pt-1 font-mono">
              {currentTaskIndex > 0 && (
                <Button
                  type="button"
                  onClick={handlePrevious}
                  disabled={navDisabled}
                  outline
                  size="xs"
                  text="Prev"
                  className="!w-auto !px-3 !font-medium"
                />
              )}

              <span className="min-w-[3.25rem] text-center text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
                {isAdvancing ? (
                  <span className="text-blue-600 dark:text-blue-400">
                    {secondsLeft}s
                  </span>
                ) : (
                  segmentLabel
                )}
              </span>

              {!isLastTask && (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={navDisabled}
                  outline
                  size="xs"
                  text={
                    savingTask
                      ? "Saving…"
                      : hasUnsavedChanges
                        ? "Save & Next"
                        : "Next"
                  }
                  loading={savingTask}
                  className="!w-auto !px-3 !font-medium"
                />
              )}

              {isLastTask && hasUnsavedChanges && (
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={navDisabled}
                  outline
                  size="sm"
                  text={savingTask ? "Saving…" : "Save"}
                  loading={savingTask}
                  className="!px-8 !text-current !font-semibold"
                />
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
