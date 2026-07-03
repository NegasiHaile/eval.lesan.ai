"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import AudioCard from "@/components/inputs/AudioCard";
import SelectTransparent from "@/components/inputs/SelectTransparent";
import TagFieldInput from "@/components/inputs/TagFieldInput";
import SpeechVideoPlayer, {
  type SpeechVideoPlayerHandle,
} from "@/components/inputs/SpeechVideoPlayer";

import Container from "@/components/utils/Container";
import Button from "@/components/utils/Button";
import Modal from "@/components/utils/Modal";
import ReviewerCommentDisplay from "@/components/ReviewerCommentDisplay";
import { useUser } from "@/context/UserContext";
import { usePresence } from "@/hooks/usePresence";
import { useTaskDuration } from "@/hooks/useTaskDuration";
import {
  BatchDetailTypes,
  SpeechBatchTasksTypes,
  SpeechTaskTypes,
  SegmentTypes,
  TagSchemaTypes,
} from "@/types/data";
import { defaultSpeechTagSchema } from "@/constants/speech";
import { validateSpeechTask } from "@/helpers/validate_speech_task";
import { Play } from "lucide-react";

type Notice = {
  title: string;
  message: string;
  variant?: "info" | "success" | "error";
};

const ACTIVE_BATCH_KEY = "speech_active_batch";

export default function SpeechPage() {
  const { user } = useUser();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [batchesDetails, setBatchesDetails] = useState<BatchDetailTypes[]>([]);
  const [selectedBatchDetail, setSelectedBatchDetail] =
    useState<BatchDetailTypes | null>(null);
  const [tagSchema, setTagSchema] = useState<TagSchemaTypes>(
    defaultSpeechTagSchema
  );
  const [batchTasks, setBatchTasks] = useState<SpeechTaskTypes[]>([]);
  const [evalTask, setEvalTask] = useState<SpeechTaskTypes | null>(null);
  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reviewerComment, setReviewerComment] = useState<string>("");
  const [savingComment, setSavingComment] = useState<boolean>(false);
  const [requiredErrors, setRequiredErrors] = useState<Set<string>>(new Set());

  const playerRef = useRef<SpeechVideoPlayerHandle>(null);

  usePresence(user, selectedBatchDetail?.batch_id);
  const { getStartedAt, getActiveDurationMs } = useTaskDuration(evalTask?.id);

  const isReviewerMode = (() => {
    if (!user?.username || !selectedBatchDetail?.qa_id) return false;
    const username = user.username.toLowerCase();
    const qaId = selectedBatchDetail.qa_id.toLowerCase();
    if (qaId !== username) return false;
    const isAnnotator =
      (selectedBatchDetail.annotator_id ?? "").toLowerCase() === username;
    const isCreator =
      (selectedBatchDetail.created_by ?? "").toLowerCase() === username;
    return !isAnnotator && !isCreator;
  })();

  const fetchBatchTasks = useCallback(
    async (batch: BatchDetailTypes): Promise<SpeechBatchTasksTypes | null> => {
      const res = await fetch(`/api/batches/speech/${batch.batch_id}`);
      if (!res.ok) return null;
      return (await res.json()) as SpeechBatchTasksTypes;
    },
    []
  );

  const loadBatchIntoState = useCallback(
    (batch: SpeechBatchTasksTypes, detail: BatchDetailTypes, index = 0) => {
      const tasks = Array.isArray(batch?.tasks) ? batch.tasks : [];
      if (tasks.length === 0) {
        setBatchTasks([]);
        setEvalTask(null);
        setCurrentTaskIndex(0);
        return;
      }
      const safeIndex = Math.min(Math.max(0, index), tasks.length - 1);
      setBatchTasks(tasks);
      setEvalTask(tasks[safeIndex]);
      setCurrentTaskIndex(safeIndex);
      setReviewerComment(tasks[safeIndex]?.reviewer_comment ?? "");
      setTagSchema(batch.tag_schema ?? defaultSpeechTagSchema);
      localStorage.setItem(
        ACTIVE_BATCH_KEY,
        JSON.stringify({
          batch_id: detail.batch_id,
          dataset_type: "speech",
          tasks,
          tag_schema: batch.tag_schema,
          currentTaskIndex: safeIndex,
        })
      );
    },
    []
  );

  const handleSelectBatch = useCallback(
    async (batch: BatchDetailTypes) => {
      setIsLoading(true);
      setRequiredErrors(new Set());
      try {
        setSelectedBatchDetail(batch);
        const fresh = await fetchBatchTasks(batch);
        if (fresh) loadBatchIntoState(fresh, batch, 0);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchBatchTasks, loadBatchIntoState]
  );

  const updateRecordingTag = (key: string, value: string | string[]) => {
    setEvalTask((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        recording_tags: { ...(prev.recording_tags ?? {}), [key]: value },
      };
    });
  };

  const updateSegmentTag = (
    segmentId: string | number,
    key: string,
    value: string | string[]
  ) => {
    setEvalTask((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        segments: prev.segments.map((s) =>
          s.id === segmentId
            ? { ...s, tags: { ...(s.tags ?? {}), [key]: value } }
            : s
        ),
      };
    });
  };

  const isThereChangeInActiveTask = (): boolean => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(ACTIVE_BATCH_KEY) || "{}"
      );
      const matching = stored?.tasks?.find(
        (t: SpeechTaskTypes) => t.id === evalTask?.id
      );
      if (!matching) return true;
      return JSON.stringify(evalTask) !== JSON.stringify(matching);
    } catch {
      return true;
    }
  };

  const updateBatchDetail = async (next: BatchDetailTypes) => {
    if (!selectedBatchDetail) return;
    const res = await fetch(
      `/api/batches-details/${selectedBatchDetail.batch_id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }
    );
    if (!res.ok) throw new Error("Failed to update batch detail");
    setSelectedBatchDetail(next);
    setBatchesDetails((prev) =>
      prev.map((b) => (b.batch_id === next.batch_id ? next : b))
    );
  };

  const saveCurrentTask = async () => {
    if (!evalTask || !selectedBatchDetail) return;
    const taskWithDuration: SpeechTaskTypes = {
      ...evalTask,
      started_at: getStartedAt(),
      completed_at: new Date().toISOString(),
      active_duration_ms: getActiveDurationMs(),
    };
    const res = await fetch(
      `/api/batches/speech/${selectedBatchDetail.batch_id}/tasks/${evalTask.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskWithDuration),
      }
    );
    if (!res.ok) throw new Error("Failed to save task");
  };

  const isTaskAnnotated = (task: SpeechTaskTypes): boolean => {
    return validateSpeechTask(task, tagSchema).isValid;
  };

  const requiredErrorKeyForRecording = (key: string) => `recording:${key}`;
  const requiredErrorKeyForSegment = (
    segmentId: string | number,
    key: string
  ) => `segment:${segmentId}:${key}`;

  const computeRequiredErrors = (task: SpeechTaskTypes): Set<string> => {
    const errors = new Set<string>();
    for (const field of tagSchema.recording_level) {
      if (!field.required) continue;
      const v = task.recording_tags?.[field.key];
      const empty =
        v === undefined ||
        v === null ||
        (Array.isArray(v) ? v.length === 0 : v.toString().trim() === "");
      if (empty) errors.add(requiredErrorKeyForRecording(field.key));
    }
    task.segments.forEach((seg) => {
      for (const field of tagSchema.segment_level) {
        if (!field.required) continue;
        const v = seg.tags?.[field.key];
        const empty =
          v === undefined ||
          v === null ||
          (Array.isArray(v) ? v.length === 0 : v.toString().trim() === "");
        if (empty) errors.add(requiredErrorKeyForSegment(seg.id, field.key));
      }
    });
    return errors;
  };

  const handlePrev = () => {
    if (currentTaskIndex <= 0) {
      setNotice({
        title: "First task",
        message: "You are already at the first task.",
        variant: "info",
      });
      return;
    }
    const prevIndex = currentTaskIndex - 1;
    setCurrentTaskIndex(prevIndex);
    setEvalTask(batchTasks[prevIndex]);
    setReviewerComment(batchTasks[prevIndex]?.reviewer_comment ?? "");
    setRequiredErrors(new Set());
  };

  const handleSaveAndNext = async () => {
    if (!evalTask || !selectedBatchDetail) return;

    const validation = validateSpeechTask(evalTask, tagSchema);
    if (!validation.isValid) {
      setRequiredErrors(computeRequiredErrors(evalTask));
      setNotice({
        title: "Required fields missing",
        message: validation.errorTitles?.join("\n") ?? validation.message ?? "",
        variant: "error",
      });
      return;
    }
    setRequiredErrors(new Set());

    const updatedTasks = [...batchTasks];
    updatedTasks[currentTaskIndex] = evalTask;
    setBatchTasks(updatedTasks);

    if (isThereChangeInActiveTask()) {
      try {
        await saveCurrentTask();
        const annotatedCount = updatedTasks.filter(isTaskAnnotated).length;
        await updateBatchDetail({
          ...selectedBatchDetail,
          annotated_tasks: annotatedCount,
        });
      } catch {
        setNotice({
          title: "Save failed",
          message: "Failed to save annotation. Please try again.",
          variant: "error",
        });
        return;
      }
    }

    const nextIndex = currentTaskIndex + 1;
    if (nextIndex < batchTasks.length) {
      setEvalTask(updatedTasks[nextIndex]);
      setCurrentTaskIndex(nextIndex);
      setReviewerComment(updatedTasks[nextIndex]?.reviewer_comment ?? "");
      localStorage.setItem(
        ACTIVE_BATCH_KEY,
        JSON.stringify({
          batch_id: selectedBatchDetail.batch_id,
          dataset_type: "speech",
          tasks: updatedTasks,
          tag_schema: tagSchema,
          currentTaskIndex: nextIndex,
        })
      );
    } else {
      setCurrentTaskIndex(0);
      setEvalTask(updatedTasks[0]);
      setReviewerComment(updatedTasks[0]?.reviewer_comment ?? "");
      setNotice({
        title: "End of batch",
        message: `End of <${selectedBatchDetail.batch_name}> speech tasks! Back to first task.`,
        variant: "info",
      });
      localStorage.setItem(
        ACTIVE_BATCH_KEY,
        JSON.stringify({
          batch_id: selectedBatchDetail.batch_id,
          dataset_type: "speech",
          tasks: updatedTasks,
          tag_schema: tagSchema,
          currentTaskIndex: 0,
        })
      );
    }
  };

  const handleSaveReviewerComment = async () => {
    if (!evalTask || !selectedBatchDetail) return;
    setSavingComment(true);
    try {
      const updatedTask = { ...evalTask, reviewer_comment: reviewerComment };
      const res = await fetch(
        `/api/batches/speech/${selectedBatchDetail.batch_id}/tasks/${evalTask.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedTask),
        }
      );
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      setEvalTask(updatedTask);
      const updatedTasks = [...batchTasks];
      updatedTasks[currentTaskIndex] = updatedTask;
      setBatchTasks(updatedTasks);
    } catch {
      setNotice({
        title: "Save failed",
        message: "Failed to save reviewer comment.",
        variant: "error",
      });
    } finally {
      setSavingComment(false);
    }
  };

  useEffect(() => {
    const fetchSpeechBatches = async () => {
      if (!user?.username) return;
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/batches-details?dataset_type=speech&username=${user.username}`
        );
        if (!res.ok) throw new Error("Failed to fetch batch details");
        const data: BatchDetailTypes[] = await res.json();
        if (data.length === 0) return;
        setBatchesDetails(data);

        const stored = localStorage.getItem(ACTIVE_BATCH_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as {
              batch_id?: string;
              currentTaskIndex?: number;
            };
            const existing = data.find((b) => b.batch_id === parsed.batch_id);
            if (existing) {
              setSelectedBatchDetail(existing);
              const fresh = await fetchBatchTasks(existing);
              if (fresh) {
                loadBatchIntoState(fresh, existing, parsed.currentTaskIndex ?? 0);
                return;
              }
            }
          } catch {
            // fall through to first batch
          }
        }

        const first = data[0];
        setSelectedBatchDetail(first);
        const fresh = await fetchBatchTasks(first);
        if (fresh) loadBatchIntoState(fresh, first, 0);
      } catch (err) {
        console.error("Error fetching speech batch details:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSpeechBatches();
  }, [user?.username, fetchBatchTasks, loadBatchIntoState]);

  if (!user?.username) {
    return (
      <Container>
        <div className="w-full max-w-4xl py-12 text-center text-neutral-600 dark:text-neutral-400">
          Please sign in to view speech annotation tasks.
        </div>
      </Container>
    );
  }

  if (batchesDetails.length === 0 && !isLoading) {
    return (
      <Container>
        <div className="w-full max-w-4xl py-12 text-center text-neutral-600 dark:text-neutral-400">
          No speech batches assigned to you yet.
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="w-full max-w-7xl space-y-5">
        <div className="w-full flex flex-wrap sm:flex-nowrap justify-between items-center gap-2">
          {batchesDetails.length > 0 && selectedBatchDetail && (
            <SelectTransparent
              id="selected-speech-batch"
              label="Data"
              name="selectedBatchDetail"
              value={selectedBatchDetail.batch_id}
              optionsValues={batchesDetails.map((b) => b.batch_id)}
              optionsLabels={batchesDetails.map((b) => b.batch_name)}
              searchable
              onChange={async (e) => {
                const value = String(e.target.value);
                const next = batchesDetails.find((b) => b.batch_id === value);
                if (next) await handleSelectBatch(next);
              }}
              labelClass="absolute left-3 border-r-2 pr-2"
              selectClass="pl-14"
            />
          )}
          {evalTask && (
            <span className="text-sm font-mono opacity-70">
              {currentTaskIndex + 1} / {batchTasks.length}
            </span>
          )}
        </div>

        {isLoading || !evalTask ? (
          <div className="w-full py-12 text-center text-neutral-500">
            Loading...
          </div>
        ) : (
          <>
            <SpeechVideoPlayer ref={playerRef} src={evalTask.video_url} />

            <section className="w-full p-4 rounded-lg bg-neutral-100/60 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-3">
              <h2 className="text-lg font-semibold font-mono">
                Recording-level
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tagSchema.recording_level.map((field) => (
                  <TagFieldInput
                    key={field.key}
                    field={field}
                    value={evalTask.recording_tags?.[field.key]}
                    onChange={(v) => updateRecordingTag(field.key, v)}
                    disabled={isReviewerMode}
                    isInvalid={requiredErrors.has(
                      requiredErrorKeyForRecording(field.key)
                    )}
                  />
                ))}
              </div>
            </section>

            <section className="w-full space-y-4">
              <h2 className="text-lg font-semibold font-mono">
                Segments ({evalTask.segments.length})
              </h2>
              {evalTask.segments.map((segment: SegmentTypes, idx) => (
                <div
                  key={segment.id}
                  className="w-full p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-mono font-bold">
                      Segment {idx + 1}
                    </span>
                    {typeof segment.start_time === "number" && (
                      <Button
                        size="sm"
                        variant="primary"
                        minimal
                        onClick={() =>
                          playerRef.current?.seekTo(segment.start_time ?? 0)
                        }
                        title={`Jump to ${segment.start_time.toFixed(1)}s`}
                      >
                        <Play className="size-4 shrink-0" />
                        {segment.start_time.toFixed(1)}s in video
                      </Button>
                    )}
                  </div>

                  <AudioCard
                    type="input"
                    input_url={segment.audio_url}
                  />

                  <div>
                    <label className="text-xs font-mono opacity-70">
                      Transcript
                    </label>
                    <p className="text-sm whitespace-pre-wrap p-2 rounded bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                      {segment.transcript}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {tagSchema.segment_level.map((field) => (
                      <TagFieldInput
                        key={field.key}
                        field={field}
                        value={segment.tags?.[field.key]}
                        onChange={(v) =>
                          updateSegmentTag(segment.id, field.key, v)
                        }
                        disabled={isReviewerMode}
                        isInvalid={requiredErrors.has(
                          requiredErrorKeyForSegment(segment.id, field.key)
                        )}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {!isReviewerMode && (
              <ReviewerCommentDisplay
                comment={evalTask.reviewer_comment ?? ""}
              />
            )}

            {isReviewerMode ? (
              <div className="w-full p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 space-y-2">
                <label className="text-sm font-mono font-semibold">
                  Reviewer comment
                </label>
                <textarea
                  className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                  rows={3}
                  value={reviewerComment}
                  onChange={(e) => setReviewerComment(e.target.value)}
                  placeholder="Add a review comment for this recording…"
                />
                <div className="flex items-center justify-end gap-2">
                  {currentTaskIndex > 0 && (
                    <Button
                      onClick={handlePrev}
                      outline
                      size="sm"
                      text="Prev"
                      className="!px-8 !text-current !font-semibold"
                    />
                  )}
                  <Button
                    onClick={handleSaveReviewerComment}
                    outline
                    size="sm"
                    loading={savingComment}
                    text="Save comment"
                    className="!px-6 !text-current !font-semibold"
                  />
                  <Button
                    onClick={() => {
                      const nextIndex = currentTaskIndex + 1;
                      if (nextIndex < batchTasks.length) {
                        setCurrentTaskIndex(nextIndex);
                        setEvalTask(batchTasks[nextIndex]);
                        setReviewerComment(
                          batchTasks[nextIndex]?.reviewer_comment ?? ""
                        );
                      } else {
                        setNotice({
                          title: "End of review",
                          message: "End of review tasks!",
                          variant: "info",
                        });
                      }
                    }}
                    outline
                    size="sm"
                    text="Next"
                    className="!px-8 !text-current !font-semibold"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2 font-mono">
                {currentTaskIndex > 0 && (
                  <Button
                    onClick={handlePrev}
                    outline
                    size="sm"
                    text="Prev"
                    className="!px-8 !text-current !font-semibold"
                  />
                )}
                <Button
                  onClick={handleSaveAndNext}
                  outline
                  size="sm"
                  text={isThereChangeInActiveTask() ? "Save & Next" : "Next"}
                  className="!px-8 !text-current !font-semibold"
                />
              </div>
            )}
          </>
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
