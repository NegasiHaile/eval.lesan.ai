"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, Square } from "lucide-react";
import Button from "@/components/utils/Button";
import { audioPlaybackSrc } from "@/helpers/audio_playback_url";
import { normalizeAudioContentType } from "@/constants/transcription";

type ReferenceVoiceAreaProps = {
  /** Saved reference: ASR file_id, blob URL, or media path. */
  value?: string;
  onSaveRecording: (blob: Blob) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
};

const WAVEFORM_BARS = 40;

function idleLevels(): number[] {
  return Array.from({ length: WAVEFORM_BARS }, () => 0.12);
}

export default function ReferenceVoiceArea({
  value,
  onSaveRecording,
  loading = false,
  disabled = false,
}: ReferenceVoiceAreaProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const draftUrlRef = useRef<string | undefined>(undefined);
  const startIdRef = useRef(0);

  const [recording, setRecording] = useState(false);
  const [preparingRecord, setPreparingRecord] = useState(false);
  const [draftUrl, setDraftUrl] = useState<string | undefined>(undefined);
  const [levels, setLevels] = useState<number[]>(idleLevels);

  draftUrlRef.current = draftUrl;

  const inCaptureMode = recording || preparingRecord;
  const savedPlaybackSrc = value ? audioPlaybackSrc(value) : undefined;
  const hasDraft = Boolean(draftUrl);
  const previewSrc = hasDraft ? draftUrl : savedPlaybackSrc;
  const canReRecord =
    !inCaptureMode && !disabled && Boolean(previewSrc || value);

  const revokeDraft = useCallback((url?: string) => {
    const target = url ?? draftUrlRef.current;
    if (target?.startsWith("blob:")) {
      URL.revokeObjectURL(target);
    }
  }, []);

  const clearDraft = useCallback(() => {
    revokeDraft();
    draftUrlRef.current = undefined;
    setDraftUrl(undefined);
    recordedBlobRef.current = null;
  }, [revokeDraft]);

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

  const startVisualizer = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
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

  useEffect(
    () => () => {
      stopVisualizer();
      revokeDraft();
    },
    [stopVisualizer, revokeDraft]
  );

  const startRecording = async () => {
    if (inCaptureMode || disabled || loading) return;

    const startId = ++startIdRef.current;
    clearDraft();
    setLevels(idleLevels());
    setPreparingRecord(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (startId !== startIdRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopVisualizer();
        setLevels(idleLevels());

        const rawType = mediaRecorder.mimeType || "audio/webm";
        const normalizedType = normalizeAudioContentType(rawType);
        const audioBlob = new Blob(audioChunksRef.current, {
          type: normalizedType,
        });
        recordedBlobRef.current = audioBlob;
        const url = URL.createObjectURL(audioBlob);
        draftUrlRef.current = url;
        setDraftUrl(url);
      };

      mediaRecorder.start();
      setPreparingRecord(false);
      setRecording(true);
      startVisualizer(stream);
    } catch (error) {
      if (startId === startIdRef.current) {
        setPreparingRecord(false);
      }
      console.error("Microphone access error:", error);
      stopVisualizer();
    }
  };

  const stopRecording = () => {
    if (preparingRecord) {
      startIdRef.current += 1;
      setPreparingRecord(false);
      return;
    }

    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleSave = async () => {
    const blob = recordedBlobRef.current;
    if (!blob || loading) return;
    try {
      await onSaveRecording(blob);
      clearDraft();
    } catch {
      // Keep draft so the user can retry.
    }
  };

  return (
    <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
      <div className="flex items-end gap-2 sm:gap-3 min-w-0">
        <div className="flex-1 min-w-0 flex items-end justify-center gap-[2px] sm:gap-[3px] h-12 sm:h-14 overflow-hidden">
          {previewSrc && !inCaptureMode ? (
            <audio
              key={previewSrc}
              controls
              src={previewSrc}
              className="w-full min-w-0 h-9 sm:h-10"
              title="Reference recording"
            >
              Your browser does not support the audio element.
            </audio>
          ) : (
            levels.map((level, i) => (
              <span
                key={i}
                className={`w-[2px] sm:w-[3px] shrink-0 rounded-full transition-[height] duration-75 ${
                  inCaptureMode
                    ? "bg-red-500 dark:bg-red-400"
                    : "bg-neutral-300 dark:bg-neutral-600"
                }`}
                style={{ height: `${Math.round(level * 100)}%` }}
              />
            ))
          )}
        </div>

        {inCaptureMode ? (
          <button
            type="button"
            onClick={stopRecording}
            disabled={preparingRecord}
            className="shrink-0 p-2.5 sm:p-3 rounded-full bg-red-600 hover:bg-red-500 transition cursor-pointer disabled:opacity-70"
            title="Stop"
            aria-label="Stop recording"
          >
            <Square className="size-5 text-white fill-white" />
          </button>
        ) : hasDraft ? (
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={disabled || loading}
              className="shrink-0 p-2.5 sm:p-3 rounded-full text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition cursor-pointer disabled:opacity-50"
              title="Record again"
              aria-label="Record again"
            >
              <RotateCcw className="size-5" />
            </button>
            <Button
              type="button"
              text={loading ? "Saving…" : "Save"}
              variant="primary"
              size="sm"
              onClick={() => void handleSave()}
              loading={loading}
              disabled={loading || disabled}
              className="!w-auto !px-3 sm:!px-4 shrink-0 !text-xs sm:!text-sm"
            />
          </div>
        ) : canReRecord ? (
          <button
            type="button"
            onClick={() => void startRecording()}
            disabled={disabled || loading}
            className="shrink-0 p-2.5 sm:p-3 rounded-full text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition cursor-pointer disabled:opacity-50"
            title="Record again"
            aria-label="Record again"
          >
            <RotateCcw className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startRecording()}
            disabled={disabled || loading}
            className="shrink-0 p-2.5 sm:p-3 rounded-full text-white bg-red-500 hover:bg-red-600 transition cursor-pointer disabled:opacity-50"
            title="Record"
            aria-label="Start recording"
          >
            <Mic className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}
