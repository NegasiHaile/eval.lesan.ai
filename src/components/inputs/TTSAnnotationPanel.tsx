"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronsLeft, ChevronsRight, Upload } from "lucide-react";

import TeleprompterDisplay from "@/components/inputs/TeleprompterDisplay";
import ReferenceVoiceArea, {
  WAVEFORM_BARS,
} from "@/components/inputs/ReferenceVoiceArea";
import TTSSessionSetup, {
  useTTSSessionPrefs,
} from "@/components/inputs/TTSSessionSetup";
import { normalizeAudioContentType } from "@/constants/transcription";
import { audioPlaybackSrc } from "@/helpers/audio_playback_url";
import { EvalTaskTypes } from "@/types/data";

const IDLE_LEVELS = Array.from({ length: WAVEFORM_BARS }, () => 0.12);
const NAV_BTN =
  "shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 sm:px-4 py-2 text-sm font-medium text-neutral-800 dark:text-neutral-100 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const MIN_SEGMENT_MS = 3000;
const UPLOAD_MAX_ATTEMPTS = 3;
const UPLOAD_RETRY_BASE_MS = 800;
const FINISH_FLUSH_TIMEOUT_MS = 8000;

// Thrown by the upload handler for errors that retrying cannot fix (4xx,
// oversized file, unknown task) so the retry loop fails fast instead of
// parking the segment in the pending banner forever.
export class UploadPermanentError extends Error {}

/**
 * Next segment a reader should actually voice.
 *
 * Segments a reviewer excluded are stepped over rather than presented: they are
 * not part of the dataset, so asking a reader to record one wastes booth time.
 */
function nextTaskIndex(from: number, tasks: EvalTaskTypes[]) {
  for (let i = from + 1; i < tasks.length; i++) {
    if (!tasks[i]?.excluded) return i;
  }
  return null;
}

/** Previous recordable segment, skipping excluded ones the same way. */
function prevTaskIndex(from: number, tasks: EvalTaskTypes[]) {
  for (let i = from - 1; i >= 0; i--) {
    if (!tasks[i]?.excluded) return i;
  }
  return null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const formatSegmentList = (indexes: number[]) =>
  indexes.map((i) => i + 1).join(", ");

type TTSAnnotationPanelProps = {
  evalTask: EvalTaskTypes;
  batchTasks: EvalTaskTypes[];
  currentTaskIndex: number;
  onTaskPersist: (task: EvalTaskTypes) => Promise<void>;
  onNavigate: (index: number) => void;
  onSegmentUpload: (
    blob: Blob,
    taskIndex: number,
    task: EvalTaskTypes
  ) => Promise<void>;
  onNotice: (
    title: string,
    message: string,
    variant?: "info" | "success" | "error"
  ) => void;
};

export default function TTSAnnotationPanel({
  evalTask,
  batchTasks,
  currentTaskIndex,
  onTaskPersist,
  onNavigate,
  onSegmentUpload,
  onNotice,
}: TTSAnnotationPanelProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const segmentChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("audio/webm");
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(
    null
  );
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceGenerationRef = useRef(0);
  const { prefs, setPrefs } = useTTSSessionPrefs();
  const sessionStartedAtRef = useRef<number | null>(null);
  const sessionMinutesRef = useRef(prefs.durationMinutes);
  const sessionLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const sessionLimitPendingRef = useRef(false);
  const sessionEndingRef = useRef(false);
  const minDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingBlobsRef = useRef<Map<number, { blob: Blob; task: EvalTaskTypes }>>(
    new Map()
  );
  const failedIndexesRef = useRef<Set<number>>(new Set());
  const enqueueSegmentUploadRef = useRef<
    (blob: Blob, taskIndex: number, task: EvalTaskTypes) => void
  >(() => {});
  const currentTaskIndexRef = useRef(currentTaskIndex);
  const evalTaskRef = useRef(evalTask);
  const onNavigateRef = useRef(onNavigate);
  const onTaskPersistRef = useRef(onTaskPersist);
  const onNoticeRef = useRef(onNotice);

  currentTaskIndexRef.current = currentTaskIndex;
  evalTaskRef.current = evalTask;
  onNavigateRef.current = onNavigate;
  onTaskPersistRef.current = onTaskPersist;
  onNoticeRef.current = onNotice;

  const [sessionActive, setSessionActive] = useState(false);
  const [preparingSession, setPreparingSession] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sessionLimitPending, setSessionLimitPending] = useState(false);
  const [levels, setLevels] = useState(() => IDLE_LEVELS.slice());
  const [hasMinSegmentDuration, setHasMinSegmentDuration] = useState(false);
  const [failedSegments, setFailedSegments] = useState<number[]>([]);
  const [retryingUploads, setRetryingUploads] = useState(false);

  const inCaptureMode = sessionActive || preparingSession;
  const isLastTask = nextTaskIndex(currentTaskIndex, batchTasks) == null;
  const isFirstTask = prevTaskIndex(currentTaskIndex, batchTasks) == null;
  const segmentLabel = `${currentTaskIndex + 1} / ${batchTasks.length}`;
  const displayedTask = batchTasks[currentTaskIndex] ?? evalTask;
  const busy = isAdvancing || saving;
  const waitingForMinDuration = sessionActive && !hasMinSegmentDuration;
  const navDisabled = busy || waitingForMinDuration;
  const minDurationTitle = waitingForMinDuration
    ? "Wait at least 3 seconds before continuing"
    : undefined;

  const clearAdvance = useCallback(() => {
    advanceGenerationRef.current += 1;
    if (advanceRef.current) clearTimeout(advanceRef.current);
    advanceRef.current = null;
    if (countdownRef.current) clearTimeout(countdownRef.current);
    countdownRef.current = null;
  }, []);

  const resetSegmentDurationGate = useCallback(() => {
    setHasMinSegmentDuration(false);
    if (minDurationTimerRef.current) {
      clearTimeout(minDurationTimerRef.current);
    }
    minDurationTimerRef.current = setTimeout(() => {
      setHasMinSegmentDuration(true);
    }, MIN_SEGMENT_MS);
  }, []);

  const clearSegmentDurationGate = useCallback(() => {
    setHasMinSegmentDuration(false);
    if (minDurationTimerRef.current) {
      clearTimeout(minDurationTimerRef.current);
      minDurationTimerRef.current = null;
    }
  }, []);

  const runSegmentGapCountdown = useCallback(
    (generation: number, totalMs: number) =>
      new Promise<void>((resolve) => {
        const totalSeconds = totalMs / 1000;
        setSecondsLeft(totalSeconds);

        const scheduleTick = (remaining: number) => {
          countdownRef.current = setTimeout(() => {
            if (generation !== advanceGenerationRef.current) return;
            const next = remaining - 1;
            if (next <= 0) {
              setSecondsLeft(0);
              resolve();
              return;
            }
            setSecondsLeft(next);
            scheduleTick(next);
          }, 1000);
        };

        scheduleTick(totalSeconds);
      }),
    []
  );

  const waitForGap = useCallback(
    (ms: number, generation: number) =>
      new Promise<void>((resolve) => {
        advanceRef.current = setTimeout(() => {
          if (generation !== advanceGenerationRef.current) return;
          resolve();
        }, ms);
      }),
    []
  );

  const clearSessionLimit = useCallback(() => {
    if (sessionLimitTimerRef.current) {
      clearTimeout(sessionLimitTimerRef.current);
      sessionLimitTimerRef.current = null;
    }
  }, []);

  const stopVisualizer = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopVisualizer();
    setLevels(IDLE_LEVELS.slice());
  }, [stopVisualizer]);

  const startVisualizer = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    void audioContext.resume();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(data);
      const step = Math.floor(data.length / WAVEFORM_BARS);
      const next = Array.from({ length: WAVEFORM_BARS }, (_, i) => {
        const v = data[i * step] / 255;
        return Math.max(0.08, v);
      });
      setLevels(next);
      animationRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const buildBlobFromChunks = useCallback((): Blob | null => {
    if (segmentChunksRef.current.length === 0) return null;
    const blob = new Blob(segmentChunksRef.current, {
      type: normalizeAudioContentType(mimeTypeRef.current),
    });
    segmentChunksRef.current = [];
    return blob.size > 0 ? blob : null;
  }, []);

  const syncFailedSegments = useCallback(() => {
    setFailedSegments(
      Array.from(failedIndexesRef.current).sort((a, b) => a - b)
    );
  }, []);

  const clearFailedUpload = useCallback(
    (taskIndex: number) => {
      pendingBlobsRef.current.delete(taskIndex);
      if (failedIndexesRef.current.delete(taskIndex)) {
        syncFailedSegments();
      }
    },
    [syncFailedSegments]
  );

  const markFailedUpload = useCallback(
    (taskIndex: number, blob: Blob, task: EvalTaskTypes) => {
      pendingBlobsRef.current.set(taskIndex, { blob, task });
      failedIndexesRef.current.add(taskIndex);
      syncFailedSegments();
    },
    [syncFailedSegments]
  );

  const uploadWithRetry = useCallback(
    async (blob: Blob, taskIndex: number, task: EvalTaskTypes) => {
      pendingBlobsRef.current.set(taskIndex, { blob, task });

      for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
        try {
          await onSegmentUpload(blob, taskIndex, task);
          clearFailedUpload(taskIndex);
          return;
        } catch (err) {
          if (err instanceof UploadPermanentError) {
            clearFailedUpload(taskIndex);
            onNoticeRef.current(
              "Upload failed",
              `Segment ${taskIndex + 1}: ${err.message}`,
              "error"
            );
            return;
          }
          if (attempt < UPLOAD_MAX_ATTEMPTS) {
            await sleep(UPLOAD_RETRY_BASE_MS * 2 ** (attempt - 1));
          }
        }
      }

      markFailedUpload(taskIndex, blob, task);
    },
    [clearFailedUpload, markFailedUpload, onSegmentUpload]
  );

  const enqueueSegmentUpload = useCallback(
    (blob: Blob, taskIndex: number, task: EvalTaskTypes) => {
      pendingBlobsRef.current.set(taskIndex, { blob, task });
      uploadQueueRef.current = uploadQueueRef.current
        .then(() => uploadWithRetry(blob, taskIndex, task))
        .catch(() => {
          markFailedUpload(taskIndex, blob, task);
        });
    },
    [markFailedUpload, uploadWithRetry]
  );

  enqueueSegmentUploadRef.current = enqueueSegmentUpload;

  const flushUploadQueue = useCallback(async () => {
    await uploadQueueRef.current;
  }, []);

  const retryFailedUploads = useCallback(async () => {
    const targets = Array.from(failedIndexesRef.current)
      .filter((taskIndex) => pendingBlobsRef.current.has(taskIndex))
      .sort((a, b) => a - b);
    if (targets.length === 0) return;

    setRetryingUploads(true);
    try {
      // Indexes stay in the failed set until their upload succeeds
      // (clearFailedUpload), so the banner reflects live progress.
      for (const taskIndex of targets) {
        const entry = pendingBlobsRef.current.get(taskIndex);
        if (!entry) continue;
        enqueueSegmentUpload(entry.blob, taskIndex, entry.task);
      }
      await flushUploadQueue();

      if (failedIndexesRef.current.size > 0) {
        onNotice(
          "Upload incomplete",
          `Still pending: ${formatSegmentList(
            Array.from(failedIndexesRef.current).sort((a, b) => a - b)
          )}. Try again.`,
          "error"
        );
      } else {
        onNotice("Uploaded", "All pending segments are saved.", "success");
      }
    } finally {
      setRetryingUploads(false);
    }
  }, [enqueueSegmentUpload, flushUploadQueue, onNotice]);

  const startSegmentRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    segmentChunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    mimeTypeRef.current = normalizeAudioContentType(
      mediaRecorder.mimeType || mimeTypeRef.current || "audio/webm"
    );
    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) segmentChunksRef.current.push(event.data);
    };
    mediaRecorder.onstop = () => {
      if (sessionEndingRef.current) releaseStream();
    };
    mediaRecorder.start(1000);
  }, [releaseStream]);

  const waitForRecorderStop = useCallback(async (recorder: MediaRecorder) => {
    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      if (typeof recorder.requestData === "function") {
        recorder.requestData();
      }
      recorder.stop();
    });
    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });
  }, []);

  const stopCurrentSegmentRecording = useCallback(async (): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return null;

    await waitForRecorderStop(recorder);
    return buildBlobFromChunks();
  }, [buildBlobFromChunks, waitForRecorderStop]);

  const finalizeCurrentSegment = useCallback(
    async (taskIndex: number): Promise<Blob | null> => {
      const blob = await stopCurrentSegmentRecording();
      if (!blob) return null;

      const mayContinueRecording =
        streamRef.current &&
        !sessionEndingRef.current &&
        !sessionLimitPendingRef.current;

      if (mayContinueRecording) {
        startSegmentRecorder();
      }

      enqueueSegmentUpload(blob, taskIndex, evalTaskRef.current);
      return blob;
    },
    [enqueueSegmentUpload, startSegmentRecorder, stopCurrentSegmentRecording]
  );

  const endSessionAfterGracePeriod = useCallback(() => {
    sessionLimitPendingRef.current = false;
    setSessionLimitPending(false);
    clearSessionLimit();
    clearSegmentDurationGate();

    setSessionActive(false);
    sessionStartedAtRef.current = null;
    mediaRecorderRef.current = null;
    releaseStream();
  }, [clearSegmentDurationGate, clearSessionLimit, releaseStream]);

  const finishSession = useCallback(async () => {
    if (!sessionActive || saving) return;

    clearSessionLimit();
    sessionLimitPendingRef.current = false;
    setSessionLimitPending(false);
    setSaving(true);
    const taskIndex = currentTaskIndexRef.current;

    try {
      sessionEndingRef.current = true;

      const blob = await stopCurrentSegmentRecording();
      setSessionActive(false);
      sessionStartedAtRef.current = null;
      mediaRecorderRef.current = null;
      clearSegmentDurationGate();

      await onTaskPersistRef.current(evalTaskRef.current);

      if (blob) {
        enqueueSegmentUpload(blob, taskIndex, evalTaskRef.current);
      }

      // Don't hold "saving" hostage to retry backoff: give the queue a
      // bounded window, then let it drain in the background — failures
      // surface in the pending banner when they resolve.
      const flushed = await Promise.race([
        flushUploadQueue().then(() => true),
        sleep(FINISH_FLUSH_TIMEOUT_MS).then(() => false),
      ]);

      const failed = Array.from(failedIndexesRef.current).sort((a, b) => a - b);
      if (!flushed) {
        onNotice(
          "Uploads in progress",
          "Uploads are finishing in the background.",
          "info"
        );
      } else if (failed.length > 0) {
        onNotice(
          "Upload pending",
          `Segments ${formatSegmentList(failed)} still need upload.`,
          "error"
        );
      }
    } finally {
      sessionEndingRef.current = false;
      setSaving(false);
    }
  }, [
    clearSegmentDurationGate,
    clearSessionLimit,
    enqueueSegmentUpload,
    flushUploadQueue,
    onNotice,
    saving,
    sessionActive,
    stopCurrentSegmentRecording,
  ]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (
        !sessionActive &&
        pendingBlobsRef.current.size === 0 &&
        failedIndexesRef.current.size === 0
      ) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [sessionActive]);

  // The panel is keyed by batch, so switching batches unmounts it. Give any
  // segments that exhausted their retries one last background attempt (their
  // enqueued closures still target the batch they were recorded in) and tell
  // the user, instead of discarding the audio silently.
  useEffect(
    () => () => {
      const failed = Array.from(failedIndexesRef.current).sort((a, b) => a - b);
      if (failed.length === 0) return;
      for (const taskIndex of failed) {
        const entry = pendingBlobsRef.current.get(taskIndex);
        if (!entry) continue;
        enqueueSegmentUploadRef.current(entry.blob, taskIndex, entry.task);
      }
      onNoticeRef.current(
        "Pending uploads",
        `Segments ${formatSegmentList(failed)} were still pending — retrying in the background. Re-open the batch to verify they saved.`,
        "info"
      );
    },
    []
  );

  useEffect(
    () => () => {
      clearAdvance();
      clearSessionLimit();
      clearSegmentDurationGate();
      sessionEndingRef.current = true;
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      releaseStream();
      sessionEndingRef.current = false;
    },
    [clearAdvance, clearSegmentDurationGate, clearSessionLimit, releaseStream]
  );

  const startSession = async () => {
    if (inCaptureMode || saving) return;
    setPreparingSession(true);
    sessionEndingRef.current = false;
    sessionLimitPendingRef.current = false;
    setSessionLimitPending(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      startSegmentRecorder();
      startVisualizer(stream);
      resetSegmentDurationGate();

      sessionStartedAtRef.current = Date.now();
      sessionMinutesRef.current = prefs.durationMinutes;
      clearSessionLimit();
      if (prefs.durationMinutes > 0) {
        sessionLimitTimerRef.current = setTimeout(() => {
          sessionLimitPendingRef.current = true;
          setSessionLimitPending(true);
        }, prefs.durationMinutes * 60_000);
      }

      setPreparingSession(false);
      setSessionActive(true);
    } catch (err) {
      setPreparingSession(false);
      releaseStream();
      onNotice(
        "Microphone error",
        err instanceof Error ? err.message : "Could not access the microphone.",
        "error"
      );
    }
  };

  const persistThenNavigate = useCallback(
    async (nextIndex: number) => {
      try {
        await onTaskPersistRef.current(evalTaskRef.current);
      } catch {
        onNotice(
          "Save failed",
          "Could not save task progress. Continuing to the next segment.",
          "error"
        );
      }
      onNavigateRef.current(nextIndex);
    },
    [onNotice]
  );

  const advanceTo = (nextIndex: number) => {
    if (isAdvancing || saving) return;

    // Not recording: Next just browses to the next segment (no upload, no
    // gate) — needed to move past already-recorded segments after a resume.
    if (!sessionActive) {
      onNavigateRef.current(nextIndex);
      return;
    }

    if (!hasMinSegmentDuration) return;

    clearAdvance();
    const generation = advanceGenerationRef.current;
    const gapMs = prefs.segmentGapMs;
    const sideGapMs = gapMs / 2;
    setIsAdvancing(true);

    void (async () => {
      const index = currentTaskIndexRef.current;

      // After the session limit fires, this Next both saves the segment and
      // ends the session. The upload goes through the retry queue like any
      // other segment — a failure lands in the pending banner instead of
      // blocking here, so no audio is lost and nothing hangs.
      if (sessionLimitPendingRef.current) {
        await finalizeCurrentSegment(index);
        if (generation !== advanceGenerationRef.current) return;

        clearAdvance();
        await persistThenNavigate(nextIndex);
        endSessionAfterGracePeriod();
        setIsAdvancing(false);
        setSecondsLeft(0);
        return;
      }

      const gapsDone = (async () => {
        await waitForGap(sideGapMs, generation);
        if (generation !== advanceGenerationRef.current) return;

        await finalizeCurrentSegment(index);
        if (generation !== advanceGenerationRef.current) return;

        await waitForGap(sideGapMs, generation);
      })();

      await Promise.all([
        gapsDone,
        runSegmentGapCountdown(generation, gapMs),
      ]);
      if (generation !== advanceGenerationRef.current) return;

      clearAdvance();
      await persistThenNavigate(nextIndex);
      setIsAdvancing(false);
      setSecondsLeft(0);
      resetSegmentDurationGate();
    })();
  };

  const handleNext = () => {
    if (isLastTask) return;
    const nextIndex = nextTaskIndex(
      currentTaskIndexRef.current,
      batchTasks
    );
    if (nextIndex == null) return;
    advanceTo(nextIndex);
  };

  const handlePrev = () => {
    const prevIndex = prevTaskIndex(currentTaskIndexRef.current, batchTasks);
    if (prevIndex == null) return;
    advanceTo(prevIndex);
  };

  const savedPlaybackSrc =
    displayedTask.reference && !inCaptureMode && !saving
      ? audioPlaybackSrc(displayedTask.reference)
      : undefined;

  return (
    <div className="relative w-full flex-1 flex flex-col min-h-0 overflow-hidden pt-4 sm:pt-6 md:pt-8">
      {/* Anchored inside the panel (not the viewport) so it tracks the
          annotation layout on small screens instead of floating over the
          batch selector or teleprompter. */}
      <div className="absolute left-1 sm:left-2 md:left-4 top-0 z-30">
        <TTSSessionSetup
          prefs={prefs}
          onChange={setPrefs}
          disabled={inCaptureMode || busy}
        />
      </div>

      <div className="w-full flex flex-col flex-1 min-h-0 gap-4 sm:gap-5 px-1 sm:px-0">
        <div className="w-full flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_auto] gap-3 md:gap-x-3 md:gap-y-1">
          <div className="hidden md:block md:col-start-1 md:row-start-1 min-w-0" aria-hidden />

          <div className="w-full max-w-6xl md:w-[min(100%,80rem)] md:col-start-2 md:row-start-1 flex flex-col min-h-0 h-full bg-white dark:bg-neutral-900 shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-neutral-200/90 dark:border-neutral-700 rounded-lg overflow-hidden">
            <TeleprompterDisplay
              text={displayedTask.input}
              fontSize={prefs.fontSize}
              isCountingDown={isAdvancing}
              secondsLeft={secondsLeft}
              className="flex-1 min-h-0 !pt-2 !pb-1 sm:!pt-3 sm:!pb-2"
            />

            <div className="shrink-0 px-3 sm:px-4 pt-1.5 sm:pt-2 pb-2 sm:pb-2.5 text-center space-y-0.5">
              <span className="text-xs sm:text-sm font-medium tabular-nums text-neutral-500 dark:text-neutral-400">
                {segmentLabel}
              </span>
              {sessionLimitPending && (
                <p className="text-[10px] sm:text-xs text-amber-600/90 dark:text-amber-400/90">
                  {sessionMinutesRef.current} min limit
                </p>
              )}
              {sessionActive && Boolean(displayedTask.reference?.trim()) && (
                <p className="text-[10px] sm:text-xs text-amber-600/90 dark:text-amber-400/90">
                  Re-recording — replaces this prompt&apos;s saved take
                </p>
              )}
            </div>
          </div>

          <div className="hidden md:flex md:col-start-3 md:row-start-1 self-center min-w-0 items-center justify-end pl-3 pr-0 min-h-9">
            {prefs.showPlayer && savedPlaybackSrc && (
              <audio
                key={savedPlaybackSrc}
                controls
                src={savedPlaybackSrc}
                className="w-full max-w-48 h-9 shrink-0"
                title="Segment recording"
              >
                Your browser does not support the audio element.
              </audio>
            )}
          </div>

          <div className="md:col-span-3 md:row-start-2 shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2 pb-0.5">
            <div className="flex justify-start pl-4 sm:pl-8 md:pl-12">
              {prefs.showPrev && (
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={isFirstTask || navDisabled}
                  title={
                    minDurationTitle ??
                    (sessionActive
                      ? "Saves this take, then re-records the previous prompt"
                      : undefined)
                  }
                  className={NAV_BTN}
                >
                  <ChevronsLeft className="size-4" aria-hidden />
                  Prev
                </button>
              )}
            </div>
            <ReferenceVoiceArea
              inCaptureMode={inCaptureMode}
              levels={levels}
              isLastTask={isLastTask}
              saving={saving || retryingUploads}
              preparingSession={preparingSession}
              disabled={isAdvancing}
              className="!w-auto !max-w-xl !mx-0 !px-0"
              startTitle={
                prefs.durationMinutes > 0
                  ? `Start ${prefs.durationMinutes}-min session`
                  : "Start recording"
              }
              canStop={sessionLimitPending || prefs.durationMinutes === 0}
              onStart={() => void startSession()}
              onStop={() => void finishSession()}
            />
            <div className="flex justify-end pr-4 sm:pr-8 md:pr-12">
              <button
                type="button"
                onClick={handleNext}
                disabled={isLastTask || navDisabled}
                title={minDurationTitle}
                className={NAV_BTN}
              >
                Next
                <ChevronsRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          {prefs.showPlayer && savedPlaybackSrc && (
            <div className="md:hidden w-full flex justify-end pr-0">
              <audio
                key={savedPlaybackSrc}
                controls
                src={savedPlaybackSrc}
                className="w-full max-w-xs h-9 shrink-0"
                title="Segment recording"
              >
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </div>

        {(failedSegments.length > 0 || retryingUploads) && (
          <div className="w-full flex justify-center shrink-0 px-1 sm:px-0 pb-2">
            <div
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white/90 dark:bg-neutral-900/90 pl-2.5 pr-1.5 py-1 shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
              role="status"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {failedSegments.length > 0 && (
                  <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[11px] font-semibold tabular-nums text-neutral-800 dark:text-neutral-100">
                    [{formatSegmentList(failedSegments)}]
                  </span>
                )}
                <span className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                  {retryingUploads
                    ? "uploading…"
                    : sessionActive || inCaptureMode || saving
                      ? "pending"
                      : "pending upload"}
                </span>
              </div>
              {!sessionActive && !inCaptureMode && !saving && (
                <button
                  type="button"
                  onClick={() => void retryFailedUploads()}
                  disabled={retryingUploads}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-900 dark:bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Upload className="size-3" aria-hidden />
                  {retryingUploads ? "Uploading…" : "Upload"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
