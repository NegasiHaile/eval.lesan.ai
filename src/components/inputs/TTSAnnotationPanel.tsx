"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

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

function nextTaskIndex(
  from: number,
  tasks: EvalTaskTypes[],
  skipRecorded: boolean
) {
  if (!skipRecorded) return from + 1 < tasks.length ? from + 1 : null;
  for (let i = from + 1; i < tasks.length; i++) {
    if (!tasks[i]?.reference?.trim()) return i;
  }
  return null;
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
  const { prefs, setPrefs } = useTTSSessionPrefs();
  const sessionStartedAtRef = useRef<number | null>(null);
  const sessionMinutesRef = useRef(prefs.durationMinutes);
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

  const [sessionActive, setSessionActive] = useState(false);
  const [preparingSession, setPreparingSession] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sessionLimitPending, setSessionLimitPending] = useState(false);
  const [levels, setLevels] = useState(() => IDLE_LEVELS.slice());

  const inCaptureMode = sessionActive || preparingSession;
  const isLastTask =
    nextTaskIndex(currentTaskIndex, batchTasks, prefs.skipRecorded) == null;
  const isFirstTask = currentTaskIndex <= 0;
  const segmentLabel = `${currentTaskIndex + 1} / ${batchTasks.length}`;
  const displayedTask = batchTasks[currentTaskIndex] ?? evalTask;

  const clearAdvance = useCallback(() => {
    advanceGenerationRef.current += 1;
    if (advanceRef.current) clearTimeout(advanceRef.current);
    advanceRef.current = null;
    if (countdownRef.current) clearTimeout(countdownRef.current);
    countdownRef.current = null;
  }, []);

  const runSegmentGapCountdown = useCallback(
    (generation: number, totalMs: number) =>
      new Promise<void>((resolve) => {
        const totalSeconds = totalMs / 1000;
        setSecondsLeft(totalSeconds);

        if (totalSeconds <= 1) {
          countdownRef.current = setTimeout(() => {
            if (generation !== advanceGenerationRef.current) return;
            setSecondsLeft(0);
            resolve();
          }, totalMs);
          return;
        }

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

    sessionEndingRef.current = false;
  }, [clearSessionLimit, releaseStream]);

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
  }, [
    clearSessionLimit,
    onNotice,
    saving,
    sessionActive,
    stopCurrentSegmentRecording,
    uploadSegment,
  ]);

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

  const advanceTo = (nextIndex: number) => {
    if (isAdvancing || saving) return;

    if (!sessionActive) {
      onNavigateRef.current(nextIndex);
      return;
    }

    clearAdvance();
    const generation = advanceGenerationRef.current;
    const gapMs = prefs.segmentGapMs;
    const sideGapMs = gapMs / 2;
    setIsAdvancing(true);

    void (async () => {
      const index = currentTaskIndexRef.current;
      const limitPending = sessionLimitPendingRef.current;

      if (limitPending) {
        try {
          await finalizeCurrentSegment(index, { awaitUpload: true });
        } catch {
          onNotice(
            "Upload failed",
            `Could not save segment ${index + 1}. Please try Next again.`,
            "error"
          );
          setIsAdvancing(false);
          return;
        }
        if (generation !== advanceGenerationRef.current) return;

        onNavigateRef.current(nextIndex);
        await endSessionAfterGracePeriod();
        setIsAdvancing(false);
        setSecondsLeft(0);
        return;
      }

      const gapsDone = (async () => {
        await waitForGap(sideGapMs, generation);
        if (generation !== advanceGenerationRef.current) return;

        try {
          await finalizeCurrentSegment(index, { awaitUpload: false });
        } catch {
          onNotice(
            "Upload failed",
            `Could not save segment ${index + 1}. Please try Next again.`,
            "error"
          );
          throw new Error("upload failed");
        }
        if (generation !== advanceGenerationRef.current) return;

        await waitForGap(sideGapMs, generation);
      })();

      try {
        await Promise.all([
          gapsDone,
          runSegmentGapCountdown(generation, gapMs),
        ]);
      } catch {
        setIsAdvancing(false);
        setSecondsLeft(0);
        return;
      }
      if (generation !== advanceGenerationRef.current) return;

      clearAdvance();
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
      setIsAdvancing(false);
      setSecondsLeft(0);
    })();
  };

  const handleNext = () => {
    if (isLastTask) return;
    const nextIndex = nextTaskIndex(
      currentTaskIndexRef.current,
      batchTasks,
      prefs.skipRecorded
    );
    if (nextIndex == null) return;
    advanceTo(nextIndex);
  };

  const handlePrev = () => {
    if (isFirstTask) return;
    advanceTo(currentTaskIndexRef.current - 1);
  };

  const savedPlaybackSrc =
    displayedTask.reference && !inCaptureMode && !saving
      ? audioPlaybackSrc(displayedTask.reference)
      : undefined;

  const busy = isAdvancing || saving;

  return (
    <div className="relative w-full flex-1 flex flex-col min-h-0 overflow-hidden pt-4 sm:pt-6 md:pt-8">
      <div className="fixed left-8 sm:left-10 md:left-14 top-24 z-30">
        <TTSSessionSetup
          prefs={prefs}
          onChange={setPrefs}
          disabled={inCaptureMode || busy}
        />
      </div>

      <div className="w-full flex flex-col flex-1 min-h-0 gap-4 sm:gap-5 px-1 sm:px-0">
        <div className="w-full flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] md:grid-rows-[1fr_auto] gap-3 md:gap-x-4 md:gap-y-2">
          <div className="hidden md:block md:col-start-1 md:row-start-1 min-w-0" aria-hidden />

          <div className="w-full max-w-4xl md:w-[min(100%,56rem)] md:col-start-2 md:row-start-1 flex flex-col flex-1 min-h-[22rem] sm:min-h-[24rem] md:min-h-[28rem] bg-white dark:bg-neutral-900 shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-neutral-200/90 dark:border-neutral-700 rounded-lg overflow-hidden">
            <TeleprompterDisplay
              text={displayedTask.input}
              fontSize={prefs.fontSize}
              isCountingDown={isAdvancing}
              secondsLeft={secondsLeft}
              className="flex-1 min-h-0 !pt-4 !pb-2 sm:!pt-5 sm:!pb-4"
            />

            <div className="shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-4 sm:pb-5 text-center space-y-1">
              <span className="text-xs sm:text-sm font-medium tabular-nums text-neutral-500 dark:text-neutral-400">
                {segmentLabel}
              </span>
              {sessionLimitPending && (
                <p className="text-[10px] sm:text-xs text-amber-600/90 dark:text-amber-400/90">
                  {sessionMinutesRef.current} min limit
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

          <div className="hidden md:flex md:col-start-1 md:row-start-2 items-center justify-end self-center pr-0 min-h-9 pb-2">
            {prefs.showPrev && (
              <button
                type="button"
                onClick={handlePrev}
                disabled={isFirstTask || busy}
                className={NAV_BTN}
              >
                <ChevronsLeft className="size-4" aria-hidden />
                Prev
              </button>
            )}
          </div>

          <div className="md:col-start-2 md:row-start-2 flex items-center justify-center pb-2">
            <ReferenceVoiceArea
              inCaptureMode={inCaptureMode}
              levels={levels}
              isLastTask={isLastTask}
              saving={saving}
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
          </div>

          <div className="hidden md:flex md:col-start-3 md:row-start-2 items-center justify-start self-center pl-0 min-h-9 pb-2">
            {prefs.showNext && (
              <button
                type="button"
                onClick={handleNext}
                disabled={isLastTask || busy}
                className={NAV_BTN}
              >
                Next
                <ChevronsRight className="size-4" aria-hidden />
              </button>
            )}
          </div>

          {(prefs.showPrev || prefs.showNext) && (
            <div className="md:hidden flex justify-between pb-2">
              <div className="min-w-[5.5rem]">
                {prefs.showPrev && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={isFirstTask || busy}
                    className={NAV_BTN}
                  >
                    <ChevronsLeft className="size-4" aria-hidden />
                    Prev
                  </button>
                )}
              </div>
              <div className="min-w-[5.5rem] flex justify-end">
                {prefs.showNext && (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={isLastTask || busy}
                    className={NAV_BTN}
                  >
                    Next
                    <ChevronsRight className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          )}

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
      </div>
    </div>
  );
}
