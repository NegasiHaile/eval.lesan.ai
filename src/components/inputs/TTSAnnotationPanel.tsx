"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronsRight } from "lucide-react";

import TeleprompterDisplay, {
  TeleprompterFontSize,
} from "@/components/inputs/TeleprompterDisplay";
import TeleprompterFontSizeControl from "@/components/inputs/TeleprompterFontSizeControl";
import ReferenceVoiceArea, {
  WAVEFORM_BARS,
} from "@/components/inputs/ReferenceVoiceArea";
import { normalizeAudioContentType } from "@/constants/transcription";
import { audioPlaybackSrc } from "@/helpers/audio_playback_url";
import { EvalTaskTypes } from "@/types/data";

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
  batchTasks: EvalTaskTypes[];
  currentTaskIndex: number;
  onTaskPersist: (task: EvalTaskTypes) => Promise<void>;
  onNavigate: (index: number) => void;
  onSegmentUpload: (blob: Blob, taskIndex: number) => Promise<void>;
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
  const sessionStartedAtRef = useRef<number | null>(null);
  const sessionLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const sessionLimitPendingRef = useRef(false);
  const sessionEndingRef = useRef(false);
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const finishSessionRef = useRef<() => Promise<void>>(async () => {});
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
  const [sessionLimitPending, setSessionLimitPending] = useState(false);
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
    async (
      taskIndex: number,
      opts?: { awaitUpload?: boolean }
    ): Promise<Blob | null> => {
      const blob = await stopCurrentSegmentRecording();
      if (!blob) return null;

      const mayContinueRecording =
        streamRef.current &&
        !sessionEndingRef.current &&
        !sessionLimitPendingRef.current;

      if (mayContinueRecording) {
        startSegmentRecorder();
      }

      if (opts?.awaitUpload) {
        await uploadSegment(blob, taskIndex);
      } else {
        enqueueSegmentUpload(blob, taskIndex);
      }
      return blob;
    },
    [
      enqueueSegmentUpload,
      startSegmentRecorder,
      stopCurrentSegmentRecording,
      uploadSegment,
    ]
  );

  const endSessionAfterGracePeriod = useCallback(async () => {
    sessionLimitPendingRef.current = false;
    setSessionLimitPending(false);
    clearSessionLimit();
    sessionEndingRef.current = true;

    setSessionActive(false);
    sessionStartedAtRef.current = null;
    mediaRecorderRef.current = null;
    releaseStream();

    try {
      await onTaskPersistRef.current(evalTaskRef.current);
      onNotice(
        "Session ended",
        "Your segment was saved. Start again when you're ready to continue.",
        "info"
      );
    } finally {
      sessionEndingRef.current = false;
    }
  }, [clearSessionLimit, onNotice, releaseStream]);

  const finishSession = useCallback(
    async () => {
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
    sessionLimitPendingRef.current = false;
    setSessionLimitPending(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      startSegmentRecorder();
      startVisualizer(stream);

      sessionStartedAtRef.current = Date.now();
      clearSessionLimit();
      sessionLimitTimerRef.current = setTimeout(() => {
        sessionLimitPendingRef.current = true;
        setSessionLimitPending(true);
        onNotice(
          "Session limit",
          "15 min limit — finish this segment to save.",
          "info"
        );
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
      const limitPending = sessionLimitPendingRef.current;

      const gapsDone = (async () => {
        await waitForGap(SEGMENT_GAP_TAIL_MS, generation);
        if (generation !== advanceGenerationRef.current) return;

        try {
          await finalizeCurrentSegment(index, { awaitUpload: limitPending });
        } catch {
          onNotice(
            "Upload failed",
            `Could not save segment ${index + 1}. Please try Next again.`,
            "error"
          );
          throw new Error("upload failed");
        }
        if (generation !== advanceGenerationRef.current) return;

        await waitForGap(SEGMENT_GAP_HEAD_MS, generation);
      })();

      try {
        await Promise.all([gapsDone, runSegmentGapCountdown(generation)]);
      } catch {
        setIsAdvancing(false);
        setSecondsLeft(0);
        return;
      }
      if (generation !== advanceGenerationRef.current) return;

      clearAdvance();

      if (limitPending) {
        await advanceAfterCountdown();
        await endSessionAfterGracePeriod();
        setIsAdvancing(false);
        setSecondsLeft(0);
        return;
      }

      await advanceAfterCountdown();
      setIsAdvancing(false);
      setSecondsLeft(0);
    })();
  };

  const savedPlaybackSrc =
    evalTask.reference && !inCaptureMode && !saving
      ? audioPlaybackSrc(evalTask.reference)
      : undefined;

  return (
    <div className="w-full flex-1 flex items-center justify-center min-h-0 py-3 sm:py-4 md:py-6 overflow-y-auto overflow-x-hidden">
      <div className="w-full max-w-6xl flex flex-col gap-5 sm:gap-6 md:gap-8 px-1 sm:px-0">
        <div className="w-full flex flex-col md:flex-row md:items-center gap-3 md:gap-2">
          <div className="hidden md:block flex-1 min-w-0" aria-hidden />

          <div className="w-full md:max-w-3xl md:shrink-0 mx-auto md:mx-0 bg-white dark:bg-neutral-900 shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-neutral-200/90 dark:border-neutral-700 rounded-lg overflow-hidden">
            <div className="flex justify-end px-3 pt-3 sm:px-4">
              <TeleprompterFontSizeControl
                value={fontSize}
                disabled={isAdvancing}
                onChange={(next) => {
                  setFontSize(next);
                  localStorage.setItem(FONT_STORAGE_KEY, next);
                }}
              />
            </div>

            <TeleprompterDisplay
              text={evalTask.input}
              fontSize={fontSize}
              isCountingDown={isAdvancing}
              secondsLeft={secondsLeft}
              className="!min-h-0 !pt-1 !pb-2 sm:!pt-2 sm:!pb-4"
            />

            <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-4 sm:pb-5 text-center space-y-1">
              <span className="text-xs sm:text-sm font-medium tabular-nums text-neutral-500 dark:text-neutral-400">
                {segmentLabel}
              </span>
              {sessionLimitPending && (
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400">
                  15 min limit — finish segment to save.
                </p>
              )}
            </div>
          </div>

          {savedPlaybackSrc && (
            <div className="w-full md:flex-1 md:min-w-0 flex items-center justify-end md:justify-end shrink-0">
              <audio
                key={savedPlaybackSrc}
                controls
                src={savedPlaybackSrc}
                className="w-full max-w-xs sm:max-w-sm md:w-48 md:max-w-none h-9 shrink-0"
                title="Segment recording"
              >
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          {!savedPlaybackSrc && (
            <div className="hidden md:block flex-1 min-w-0" aria-hidden />
          )}
        </div>

        <div className="w-full flex justify-center px-1 sm:px-0">
          <ReferenceVoiceArea
            inCaptureMode={inCaptureMode}
            levels={levels}
            isLastTask={isLastTask}
            saving={saving}
            preparingSession={preparingSession}
            disabled={isAdvancing}
            onStart={() => void startSession()}
            onStop={() => void finishSession()}
          />
        </div>

        <div className="w-full flex justify-end min-h-[2.5rem] px-1 sm:px-0">
          {!isLastTask && (
            <button
              type="button"
              onClick={handleNext}
              disabled={isAdvancing || saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 sm:px-4 py-2 text-sm font-medium text-neutral-800 dark:text-neutral-100 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronsRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
