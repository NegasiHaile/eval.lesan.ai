"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import DomainsList from "@/components/DomainsList";
import TeleprompterDisplay, {
  TeleprompterFontSize,
} from "@/components/inputs/TeleprompterDisplay";
import TeleprompterFontSizeControl from "@/components/inputs/TeleprompterFontSizeControl";
import ReferenceVoiceArea, {
  WAVEFORM_BARS,
} from "@/components/inputs/ReferenceVoiceArea";
import Button from "@/components/utils/Button";
import { normalizeAudioContentType } from "@/constants/transcription";
import { BatchDetailTypes, EvalTaskTypes } from "@/types/data";

const SEGMENT_GAP_TAIL_MS = 1000;
const SEGMENT_GAP_HEAD_MS = 1000;
const SEGMENT_GAP_TOTAL_MS = SEGMENT_GAP_TAIL_MS + SEGMENT_GAP_HEAD_MS;
const MAX_SESSION_MS = 15 * 60 * 1000;
const FONT_STORAGE_KEY = "tts_teleprompter_font_size";

function readStoredFontSize(): TeleprompterFontSize {
  if (typeof window === "undefined") return "md";
  const stored = localStorage.getItem(FONT_STORAGE_KEY);
  if (stored === "sm" || stored === "md" || stored === "lg") return stored;
  return "md";
}

function idleLevels(): number[] {
  return Array.from({ length: WAVEFORM_BARS }, () => 0.12);
}

type TTSAnnotationPanelProps = {
  evalTask: EvalTaskTypes;
  selectedBatchDetail: BatchDetailTypes;
  batchTasks: EvalTaskTypes[];
  currentTaskIndex: number;
  onTaskPersist: (task: EvalTaskTypes) => Promise<void>;
  onNavigate: (index: number) => void;
  onSegmentUpload: (blob: Blob, taskIndex: number) => Promise<void>;
  onToggleDomain: (name: string) => void;
  onNotice: (
    title: string,
    message: string,
    variant?: "info" | "success" | "error"
  ) => void;
};

export default function TTSAnnotationPanel({
  evalTask,
  selectedBatchDetail,
  batchTasks,
  currentTaskIndex,
  onTaskPersist,
  onNavigate,
  onSegmentUpload,
  onToggleDomain,
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
  const sessionStartedAtRef = useRef<number | null>(null);
  const sessionLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const sessionEndingRef = useRef(false);
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const finishSessionRef = useRef<
    (opts?: { forced?: boolean }) => Promise<void>
  >(async () => {});
  const currentTaskIndexRef = useRef(currentTaskIndex);
  const evalTaskRef = useRef(evalTask);
  const onNavigateRef = useRef(onNavigate);
  const onTaskPersistRef = useRef(onTaskPersist);

  currentTaskIndexRef.current = currentTaskIndex;
  evalTaskRef.current = evalTask;
  onNavigateRef.current = onNavigate;
  onTaskPersistRef.current = onTaskPersist;

  const [fontSize, setFontSize] = useState<TeleprompterFontSize>(readStoredFontSize);
  const [sessionActive, setSessionActive] = useState(false);
  const [preparingSession, setPreparingSession] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState<number[]>(idleLevels);

  const inCaptureMode = sessionActive || preparingSession;
  const isLastTask = currentTaskIndex >= batchTasks.length - 1;
  const segmentLabel = `${currentTaskIndex + 1} / ${batchTasks.length}`;

  const clearAdvance = useCallback(() => {
    advanceGenerationRef.current += 1;
    if (advanceRef.current) clearTimeout(advanceRef.current);
    advanceRef.current = null;
    if (countdownRef.current) clearTimeout(countdownRef.current);
    countdownRef.current = null;
  }, []);

  const runSegmentGapCountdown = useCallback(
    (generation: number) =>
      new Promise<void>((resolve) => {
        const totalSeconds = SEGMENT_GAP_TOTAL_MS / 1000;
        setSecondsLeft(totalSeconds);

        const scheduleTick = (remaining: number) => {
          countdownRef.current = setTimeout(() => {
            if (generation !== advanceGenerationRef.current) return;
            const next = remaining - 1;
            if (next <= 0) {
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
    setLevels(idleLevels());
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

  const uploadSegment = useCallback(
    async (blob: Blob, taskIndex: number) => {
      await onSegmentUpload(blob, taskIndex);
    },
    [onSegmentUpload]
  );

  const enqueueSegmentUpload = useCallback(
    (blob: Blob, taskIndex: number) => {
      uploadQueueRef.current = uploadQueueRef.current
        .then(() => uploadSegment(blob, taskIndex))
        .catch(() => {
          onNotice(
            "Upload failed",
            `Could not upload audio for segment ${taskIndex + 1}. Please try again.`,
            "error"
          );
        });
    },
    [onNotice, uploadSegment]
  );

  const attachRecorderHandlers = useCallback(
    (mediaRecorder: MediaRecorder) => {
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) segmentChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        if (sessionEndingRef.current) {
          releaseStream();
        }
      };
    },
    [releaseStream]
  );

  const startSegmentRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    segmentChunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    mimeTypeRef.current = normalizeAudioContentType(
      mediaRecorder.mimeType || mimeTypeRef.current || "audio/webm"
    );
    attachRecorderHandlers(mediaRecorder);
    mediaRecorder.start(1000);
  }, [attachRecorderHandlers]);

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

      if (streamRef.current && !sessionEndingRef.current) {
        startSegmentRecorder();
      }

      enqueueSegmentUpload(blob, taskIndex);
      return blob;
    },
    [enqueueSegmentUpload, startSegmentRecorder, stopCurrentSegmentRecording]
  );

  const finishSession = useCallback(
    async (opts?: { forced?: boolean }) => {
      if (!sessionActive || saving) return;

      clearSessionLimit();
      setSaving(true);
      const taskIndex = currentTaskIndexRef.current;

      try {
        sessionEndingRef.current = true;

        const blob = await stopCurrentSegmentRecording();
        setSessionActive(false);
        sessionStartedAtRef.current = null;
        mediaRecorderRef.current = null;

        // Persist domains/metadata before upload so the reference save does not
        // overwrite evalTask with a batchTasks copy that lacks domain picks.
        await onTaskPersistRef.current(evalTaskRef.current);

        if (blob) {
          try {
            await uploadSegment(blob, taskIndex);
          } catch {
            onNotice(
              "Upload failed",
              "Could not save the last segment. Please try again.",
              "error"
            );
          }
        }

        if (opts?.forced) {
          onNotice(
            "Session limit",
            "Recording stopped after 15 minutes.",
            "info"
          );
        }
      } finally {
        sessionEndingRef.current = false;
        setSaving(false);
      }
    },
    [
      clearSessionLimit,
      onNotice,
      saving,
      sessionActive,
      stopCurrentSegmentRecording,
      uploadSegment,
    ]
  );

  useEffect(() => {
    finishSessionRef.current = finishSession;
  }, [finishSession]);

  useEffect(
    () => () => {
      clearAdvance();
      clearSessionLimit();
      sessionEndingRef.current = true;
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      releaseStream();
      sessionEndingRef.current = false;
    },
    [clearAdvance, clearSessionLimit, releaseStream]
  );

  const startSession = async () => {
    if (inCaptureMode || saving) return;
    setPreparingSession(true);
    sessionEndingRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      startSegmentRecorder();
      startVisualizer(stream);

      sessionStartedAtRef.current = Date.now();
      clearSessionLimit();
      sessionLimitTimerRef.current = setTimeout(() => {
        onNotice(
          "Session limit",
          "Recording reached the 15-minute limit.",
          "info"
        );
        void finishSessionRef.current({ forced: true });
      }, MAX_SESSION_MS);

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

  const advanceAfterCountdown = useCallback(async () => {
    const index = currentTaskIndexRef.current;
    const task = evalTaskRef.current;

    try {
      await onTaskPersistRef.current(task);
    } catch {
      onNotice(
        "Save failed",
        "Could not save task progress. Continuing to the next segment.",
        "error"
      );
    }

    onNavigateRef.current(index + 1);
  }, [onNotice]);

  const handleNext = () => {
    if (isAdvancing || isLastTask || saving) return;

    if (!sessionActive) {
      onNavigateRef.current(currentTaskIndexRef.current + 1);
      return;
    }

    clearAdvance();
    const generation = advanceGenerationRef.current;
    setIsAdvancing(true);

    void (async () => {
      const index = currentTaskIndexRef.current;

      const gapsDone = (async () => {
        // 1s tail silence at the end of the current segment audio
        await waitForGap(SEGMENT_GAP_TAIL_MS, generation);
        if (generation !== advanceGenerationRef.current) return;

        await finalizeCurrentSegment(index);
        if (generation !== advanceGenerationRef.current) return;

        // 1s head silence at the start of the next segment audio (before teleprompter advances)
        await waitForGap(SEGMENT_GAP_HEAD_MS, generation);
      })();

      await Promise.all([gapsDone, runSegmentGapCountdown(generation)]);
      if (generation !== advanceGenerationRef.current) return;

      clearAdvance();
      setIsAdvancing(false);
      setSecondsLeft(0);
      await advanceAfterCountdown();
    })();
  };

  const handlePrev = () => {
    if (currentTaskIndex <= 0 || isAdvancing || saving) {
      if (currentTaskIndex <= 0) {
        onNotice(
          "First task",
          "You are already at the first task.",
          "info"
        );
      }
      return;
    }
    onNavigateRef.current(currentTaskIndex - 1);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3 sm:space-y-4">
      <div className="relative w-full">
        <div className="w-full rounded-lg sm:rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 overflow-hidden">
          <TeleprompterDisplay
            text={evalTask.input}
            fontSize={fontSize}
            isCountingDown={isAdvancing}
            secondsLeft={secondsLeft}
            className="!min-h-[20vh] sm:!min-h-[24vh] md:!min-h-[28vh]"
          />
        </div>

        <div className="absolute bottom-0 left-full ml-2 sm:ml-3 max-sm:static max-sm:mt-1.5 max-sm:flex max-sm:justify-end">
          <TeleprompterFontSizeControl
            value={fontSize}
            disabled={isAdvancing}
            onChange={(next) => {
              setFontSize(next);
              localStorage.setItem(FONT_STORAGE_KEY, next);
            }}
          />
        </div>
      </div>

      <div className="rounded-lg sm:rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 overflow-hidden">
        <ReferenceVoiceArea
          inCaptureMode={inCaptureMode}
          levels={levels}
          isLastTask={isLastTask}
          saving={saving}
          preparingSession={preparingSession}
          disabled={isAdvancing}
          value={evalTask.reference}
          onStart={() => void startSession()}
          onStop={() => void finishSession()}
        />
      </div>

      <div className="min-w-0 overflow-hidden">
        <DomainsList
          domains={selectedBatchDetail.domains ?? undefined}
          selectedDomains={evalTask.domain ?? []}
          toggleDomainSelection={onToggleDomain}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pb-2 font-mono">
        {currentTaskIndex > 0 && (
          <Button
            type="button"
            onClick={handlePrev}
            disabled={isAdvancing || saving}
            outline
            size="xs"
            text="Prev"
            className="!w-auto !px-2.5 sm:!px-3 !font-medium"
          />
        )}

        <span className="min-w-[2.75rem] text-center text-xs font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
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
            disabled={isAdvancing || saving}
            outline
            size="xs"
            text="Next"
            className="!w-auto !px-2.5 sm:!px-3 !font-medium"
          />
        )}
      </div>
    </div>
  );
}
