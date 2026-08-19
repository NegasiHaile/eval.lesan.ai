"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Loader2, Mic, RotateCcw, Square } from "lucide-react";

import SelectOption from "@/components/inputs/SelectOption";
import AudioPlayer from "@/components/inputs/AudioPlayer";
import Container from "@/components/utils/Container";
import Button from "@/components/utils/Button";
import Modal from "@/components/utils/Modal";
import Signup from "@/components/Signup";
import { languages } from "@/constants/languages";
import {
  ASR_RECORDING_HOSTING_LABEL,
  ASR_RECORDING_LANGUAGE_KEY,
  ASR_RECORDING_MAX_MS,
  ASR_RECORDING_MAX_WARNING_MS,
  ASR_RECORDING_MIN_MS,
  ASR_RECORDING_RANGE_LABEL,
  ASR_RECORDING_SAVING_LABEL,
  ASR_RECORDING_SUBMIT_LABEL,
  formatRecordingDuration,
} from "@/constants/asr_recording";
import { normalizeAudioContentType } from "@/constants/transcription";
import { referenceAudioFilename } from "@/helpers/reference_audio_filename";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useUser } from "@/context/UserContext";
import { LanguageTypes } from "@/types/languages";

const recordButtonClass =
  "relative p-4 rounded-full text-red-500 hover:text-red-700 bg-neutral-100/80 hover:bg-red-400/20 dark:bg-neutral-900 transition duration-200 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

const stopButtonClass =
  "relative bg-red-500 isolate p-4 rounded-full hover:bg-red-400 shadow-md transition duration-200 group cursor-pointer";

const againButtonClass =
  "relative p-4 rounded-full text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white bg-neutral-100/80 hover:bg-neutral-200/80 dark:bg-neutral-900 dark:hover:bg-neutral-800 transition duration-200 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

function persistLanguage(lang: LanguageTypes) {
  try {
    localStorage.setItem(ASR_RECORDING_LANGUAGE_KEY, lang.iso_639_3);
  } catch {
    // ignore quota / private mode
  }
}

type SubmitStage = "idle" | "hosting" | "saving";

type JsonBody = {
  error?: string;
  file_id?: string;
  url?: string;
};

function postFormData(
  url: string,
  formData: FormData
): Promise<{ ok: boolean; status: number; body: JsonBody }> {
  return fetch(url, { method: "POST", body: formData }).then(async (response) => {
    let body: JsonBody = {};
    try {
      body = (await response.json()) as JsonBody;
    } catch {
      body = { error: "Failed to host audio." };
    }
    return { ok: response.ok, status: response.status, body };
  });
}

export default function AsrRecordingPage() {
  const { user } = useUser();
  const [language, setLanguage] = useState<LanguageTypes>(languages[0]);
  const [submitStage, setSubmitStage] = useState<SubmitStage>("idle");
  const submittingRef = useRef(false);
  const [isSigninOpen, setIsSigninOpen] = useState(false);
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
    variant?: "info" | "success" | "error";
  } | null>(null);

  const {
    recording,
    draftUrl,
    hasDraft,
    recordedBlobRef,
    elapsedMs,
    startRecording,
    stopRecording,
    clearDraft,
  } = useAudioRecorder({ maxDurationMs: ASR_RECORDING_MAX_MS });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ASR_RECORDING_LANGUAGE_KEY);
      const match = languages.find((lang) => lang.iso_639_3 === stored);
      if (match) setLanguage(match);
    } catch {
      // ignore
    }
  }, []);

  const durationOk =
    elapsedMs >= ASR_RECORDING_MIN_MS && elapsedMs <= ASR_RECORDING_MAX_MS;
  const approachingMax =
    elapsedMs >= ASR_RECORDING_MAX_MS - ASR_RECORDING_MAX_WARNING_MS;
  const progressPct = Math.min(100, (elapsedMs / ASR_RECORDING_MAX_MS) * 100);
  const rangeTone = useMemo(() => {
    if (elapsedMs <= 0) return "neutral";
    if (approachingMax) return "red";
    if (elapsedMs >= ASR_RECORDING_MIN_MS) return "green";
    return "yellow";
  }, [elapsedMs, approachingMax]);
  const rangeColorClass = {
    yellow: "bg-yellow-400",
    green: "bg-emerald-500",
    red: "bg-red-500",
    neutral: "bg-neutral-400 dark:bg-neutral-500",
  }[rangeTone];
  const timerClass = {
    yellow: "text-yellow-500",
    green: "text-emerald-600 dark:text-emerald-400",
    red: "text-red-500",
    neutral: "text-neutral-800 dark:text-neutral-100",
  }[rangeTone];

  const isSubmitting = submitStage !== "idle";
  const submitLabel =
    submitStage === "hosting"
      ? ASR_RECORDING_HOSTING_LABEL
      : submitStage === "saving"
        ? ASR_RECORDING_SAVING_LABEL
        : ASR_RECORDING_SUBMIT_LABEL;

  const handleStart = async () => {
    if (!user?.username) {
      setIsSigninOpen(true);
      return;
    }

    const ok = await startRecording();
    if (!ok) {
      setNotice({
        title: "Microphone",
        message: "Allow microphone access to record.",
        variant: "error",
      });
    }
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    const blob = recordedBlobRef.current;
    if (!blob || !durationOk) return;

    if (!user?.username) {
      setIsSigninOpen(true);
      return;
    }

    submittingRef.current = true;
    flushSync(() => {
      setSubmitStage("hosting");
    });
    try {
      const contentType = normalizeAudioContentType(blob.type || "audio/webm");
      const formData = new FormData();
      formData.append(
        "file",
        new File([blob], referenceAudioFilename(contentType), {
          type: contentType,
        })
      );
      formData.append("duration_ms", String(elapsedMs));

      const hosted = await postFormData("/api/asr-recording", formData);

      if (hosted.status === 401) {
        setIsSigninOpen(true);
        return;
      }
      if (!hosted.ok || !hosted.body.file_id) {
        throw new Error(hosted.body.error || "Failed to host audio.");
      }

      setSubmitStage("saving");

      const saveResponse = await fetch("/api/asr-recording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: hosted.body.file_id,
          language: language.iso_639_3,
          duration_ms: elapsedMs,
        }),
      });
      const saveBody = (await saveResponse.json()) as JsonBody;

      if (saveResponse.status === 401) {
        setIsSigninOpen(true);
        return;
      }
      if (!saveResponse.ok) {
        throw new Error(saveBody.error || "Failed to save recording.");
      }

      clearDraft();
    } catch (error) {
      setNotice({
        title: "Submit failed",
        message:
          error instanceof Error ? error.message : "Could not submit recording.",
        variant: "error",
      });
    } finally {
      submittingRef.current = false;
      setSubmitStage("idle");
    }
  };

  return (
    <Container>
      <div className="w-full max-w-2xl space-y-6">
        <SelectOption
          id="language"
          label="Language"
          name="language"
          value={language.iso_639_3}
          options={languages}
          onChange={(lang) => {
            setLanguage(lang);
            persistLanguage(lang);
          }}
          labelClass="absolute md:left-3 border-r-2 md:pr-2.5 opacity-50"
          selectClass="md:pl-24"
          disabled={recording || isSubmitting}
        />

        <div className="rounded-lg border border-neutral-200/80 dark:border-neutral-800/70 bg-neutral-200/70 dark:bg-neutral-800/30 shadow-md">
          <AudioPlayer
            src={!recording ? draftUrl : undefined}
            title="Recording"
            nodownload
            alwaysShowControls
            size="lg"
            actions={
              recording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className={stopButtonClass}
                  title="Stop"
                  aria-label="Stop recording"
                >
                  <span
                    className="absolute inset-0 rounded-full animate-ping bg-red-500/80 group-hover:bg-red-500/20"
                    aria-hidden
                  />
                  <Square className="size-7 text-white relative" />
                </button>
              ) : hasDraft ? (
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  className={againButtonClass}
                  title="Record again"
                  aria-label="Record again"
                  disabled={isSubmitting}
                >
                  <RotateCcw className="size-7" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  className={recordButtonClass}
                  title="Record"
                  aria-label="Start recording"
                  disabled={isSubmitting}
                >
                  <Mic className="size-7" />
                </button>
              )
            }
          />

          <div className="px-4 pb-4 space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm font-mono">
              <p className={`tabular-nums ${timerClass}`} aria-live="polite">
                {formatRecordingDuration(elapsedMs)}
                <span className="text-neutral-400 dark:text-neutral-500">
                  {" "}
                  / {formatRecordingDuration(ASR_RECORDING_MAX_MS)}
                </span>
              </p>
              <p className="text-neutral-500 dark:text-neutral-400">
                {ASR_RECORDING_RANGE_LABEL}
              </p>
            </div>
            <div className="relative h-2.5 w-full rounded-full bg-neutral-300/80 dark:bg-neutral-700">
              <div
                className="absolute inset-y-0 w-px bg-neutral-500/80"
                style={{
                  left: `${(ASR_RECORDING_MIN_MS / ASR_RECORDING_MAX_MS) * 100}%`,
                }}
                aria-hidden
              />
              <div
                className={`h-full rounded-full transition-[width,background-color] duration-200 ${rangeColorClass}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={!hasDraft || recording || !durationOk || isSubmitting}
            onClick={() => void handleSubmit()}
            className={`relative overflow-hidden flex items-center justify-center gap-2 w-auto min-w-44 px-8 py-2 rounded-md text-sm font-semibold border transition ${
              isSubmitting
                ? "opacity-50 cursor-not-allowed pointer-events-none border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 bg-neutral-200/80 dark:bg-neutral-800/80"
                : !hasDraft || recording || !durationOk
                  ? "opacity-50 cursor-not-allowed border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200"
                  : "cursor-pointer border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {isSubmitting && (
              <span
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-md"
                aria-hidden
              >
                <span className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 dark:via-white/20 to-transparent animate-slide-skeleton" />
              </span>
            )}
            {isSubmitting && (
              <Loader2 className="relative z-10 size-4 shrink-0 animate-spin" />
            )}
            <span className="relative z-10 whitespace-nowrap">{submitLabel}</span>
          </button>
        </div>
      </div>

      <Signup isOpen={isSigninOpen} setIsOpen={setIsSigninOpen} />

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
