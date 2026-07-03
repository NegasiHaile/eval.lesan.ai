"use client";
import { EvalOutputTypes, guidelineTypes } from "@/types/data";
import { TaskEvalErrorTypes } from "@/types/others";
import React, { useState } from "react";
import Button from "../utils/Button";
import Modal from "../utils/Modal";
import Tooltip from "../utils/Tooltip";
import AudioPlayer from "./AudioPlayer";
import { tausRating } from "@/constants/others";
import { audioPlaybackSrc } from "@/helpers/audio_playback_url";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Mic,
  RotateCcw,
  Square,
} from "lucide-react";

const borderColorsHex = [
  "transparent",
  "#d83636",
  "#ff4500",
  "#ffa500",
  "oklch(72.3% 0.219 149.579)",
  "oklch(70.7% 0.194 149.214)",
];

interface AudioCardProps {
  index?: number;
  type: string;
  task?: EvalOutputTypes;
  input_url?: string;
  loading?: boolean;
  className?: string;
  /** When true (default), hides download on the audio controls. */
  nodownload?: boolean;
  onUpload?: (blob: Blob) => void | Promise<void>;
  uploadButtonText?: string;
  variant?: "default" | "primary";
  onClickRankUp?: () => void;
  onClickRankDown?: () => void;
  onClickRate?: (index: number, star: number) => void;
  error?: TaskEvalErrorTypes | null;
  isLastItem?: boolean;
  readOnly?: boolean;
  rating_guideline?: guidelineTypes[];
}

const recordButtonClass =
  "relative p-3 rounded-full text-red-500 hover:text-red-700 bg-neutral-100/80 hover:bg-red-400/20 dark:bg-neutral-900 transition duration-200 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

const stopButtonClass =
  "relative bg-red-500 isolate p-3 rounded-full hover:bg-red-400 shadow-md transition duration-200 group cursor-pointer";

const againButtonClass =
  "relative p-3 rounded-full text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white bg-neutral-100/80 hover:bg-neutral-200/80 dark:bg-neutral-900 dark:hover:bg-neutral-800 transition duration-200 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

const AudioCard: React.FC<AudioCardProps> = ({
  index,
  type,
  task,
  input_url = null,
  loading = false,
  className,
  nodownload = true,
  onUpload,
  uploadButtonText = "Upload",
  variant = "default",
  onClickRankUp,
  onClickRankDown,
  onClickRate,
  error = null,
  isLastItem = false,
  readOnly = false,
  rating_guideline,
}) => {
  const ratingGuideline =
    rating_guideline && rating_guideline.length > 0
      ? rating_guideline
      : tausRating;

  const tooltipDescription = (desc: string | undefined) =>
    desc
      ? desc
          .replace(/\btranslation\b/gi, "synthesis")
          .replace(/\bthe source\b/gi, "the input text")
          .replace(/\bsource\b/gi, "input text")
      : desc;

  const {
    recording,
    draftUrl,
    hasDraft,
    recordedBlobRef,
    startRecording,
    stopRecording,
    clearDraft,
  } = useAudioRecorder();

  const [notice, setNotice] = useState<string | null>(null);

  const isReferenceRecorder = type === "input" && Boolean(onUpload);
  const hasSavedReference = Boolean(input_url?.trim());
  const canRecord = !input_url || isReferenceRecorder;

  const outputPlaybackSrc =
    type === "output" && task?.output
      ? audioPlaybackSrc(task.output)
      : undefined;
  const savedPlaybackSrc =
    type === "input" && input_url ? audioPlaybackSrc(input_url) : undefined;

  const playerSrc = (() => {
    if (type === "output") return outputPlaybackSrc;
    if (hasDraft) return draftUrl;
    if (hasSavedReference && !recording) return savedPlaybackSrc;
    return undefined;
  })();

  const handleUpload = async () => {
    const blob = recordedBlobRef.current;
    if (!onUpload || !blob) return;

    try {
      await onUpload(blob);
      clearDraft();
    } catch {
      clearDraft();
    }
  };

  const renderInputActions = () => {
    if (type !== "input" || readOnly || !canRecord) return null;

    if (recording) {
      return (
        <button
          type="button"
          onClick={stopRecording}
          className={stopButtonClass}
          title="Stop recording"
          aria-label="Stop recording"
        >
          <span
            className="absolute inset-0 rounded-full animate-ping bg-red-500/80 group-hover:bg-red-500/20"
            aria-hidden
          />
          <Square className="size-6 text-white relative" />
        </button>
      );
    }

    if (isReferenceRecorder && (hasSavedReference || hasDraft)) {
      return (
        <button
          type="button"
          onClick={() => void startRecording()}
          className={againButtonClass}
          title="Record again"
          aria-label="Record again"
          disabled={loading}
        >
          <RotateCcw className="size-6" />
        </button>
      );
    }

    if (!hasSavedReference && !hasDraft) {
      return (
        <button
          type="button"
          onClick={() => void startRecording()}
          className={recordButtonClass}
          title="Start recording"
          aria-label="Start recording"
          disabled={loading}
        >
          <Mic className="size-6" />
        </button>
      );
    }

    return null;
  };

  const renderInputFooter = () => {
    if (type !== "input" || !onUpload || !hasDraft || recording) return null;

    return (
      <Button
        type="button"
        text={loading ? "Uploading…" : uploadButtonText}
        variant="secondary"
        outline
        size="sm"
        onClick={() => void handleUpload()}
        loading={loading}
        disabled={loading}
      />
    );
  };

  const renderLegacyTranscribeFooter = () => {
    if (type !== "input" || onUpload || !hasDraft || input_url) return null;

    return (
      <Button
        type="button"
        text={loading ? "Transcribing" : "Transcribe"}
        variant="secondary"
        outline
        size="sm"
        onClick={() => {
          clearDraft();
          setNotice(
            "Realtime transcription is coming soon, for now this is only for dataset evaluation!"
          );
        }}
        loading={loading}
      />
    );
  };

  const cardSurfaceClass =
    variant === "primary"
      ? "bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80"
      : "bg-neutral-200/70 dark:bg-neutral-800/30 border border-neutral-200/80 dark:border-neutral-800/70";

  const hasEvalControls = Boolean(onClickRate);

  return (
    <div className={`w-full flex flex-col ${className}`}>
      <div
        className={`w-full ${cardSurfaceClass} shadow-md rounded-lg ${
          hasEvalControls &&
          error &&
          task &&
          error.errorTitles?.includes(task.model)
            ? "ring-2 ring-red-500"
            : ""
        }`}
      >
        {type === "input" ? (
          <AudioPlayer
            src={playerSrc}
            nodownload={nodownload}
            title={hasDraft ? "New recording" : "Reference audio"}
            actions={renderInputActions()}
            footer={renderInputFooter() ?? renderLegacyTranscribeFooter()}
          />
        ) : (
          <AudioPlayer
            src={playerSrc}
            nodownload={nodownload}
            title="Model output"
          />
        )}

        {type === "output" && task && (
          <div className="flex flex-wrap gap-2 px-2 pr-4 pb-2 items-center justify-between">
            <div className="w-fit flex space-x-1 items-center p-2 bg-neutral-100 dark:bg-neutral-900/80 rounded-bl-md rounded-tr-xl">
              🎙️
              <p className="font-mono text-sm">
                Model
                <span className="text-lg font-extrabold"> {task.model}</span>
              </p>
            </div>

            {hasEvalControls && (
              <div className="flex items-center space-x-1">
                {!readOnly && (
                  <div className="flex items-center space-x-2 mx-2">
                    {(index ?? 0) > 0 && task.output && onClickRankUp && (
                      <button
                        type="button"
                        id="up_arrow"
                        onClick={onClickRankUp}
                        className="cursor-pointer opacity-80 hover:opacity-50 group"
                        aria-label="Move up"
                      >
                        <ArrowUpFromLine
                          strokeWidth={1.5}
                          className="size-5 md:size-7 transition-transform duration-200 group-hover:-translate-y-1"
                        />
                      </button>
                    )}
                    {!isLastItem && task.output && onClickRankDown && (
                      <button
                        type="button"
                        id="down_arrow"
                        onClick={onClickRankDown}
                        className="cursor-pointer opacity-80 hover:opacity-50 group"
                        aria-label="Move down"
                      >
                        <ArrowDownToLine
                          strokeWidth={1.5}
                          className="size-5 md:size-7 transition-transform duration-200 group-hover:translate-y-1"
                        />
                      </button>
                    )}
                  </div>
                )}

                {ratingGuideline.map((item) => (
                  <Tooltip
                    key={item?.scale}
                    pointerStyle="border-t-neutral-100 dark:border-t-neutral-900"
                    tooltipContent={
                      <div className="space-y-3">
                        <p className="text-lg font-mono text-nowrap px-3 py-1 border-b border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-400">
                          Rate-Value: {item?.value} ({item?.scale})
                        </p>
                        <p className="px-3 pb-3 text-sm font-mono text-neutral-700 dark:text-neutral-400">
                          {tooltipDescription(item?.description)}
                        </p>
                      </div>
                    }
                  >
                    <button
                      type="button"
                      className={`flex items-center ${
                        readOnly
                          ? "opacity-70 cursor-not-allowed"
                          : task.output
                            ? "cursor-pointer hover:opacity-60"
                            : "opacity-40 cursor-auto"
                      }`}
                      onClick={() =>
                        !readOnly &&
                        onClickRate &&
                        onClickRate(index ?? 0, item?.scale)
                      }
                      disabled={readOnly || !task.output}
                      aria-label={`Rate ${item?.scale}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill={
                          item?.scale <= task.rate
                            ? borderColorsHex[task.rate]
                            : "none"
                        }
                        viewBox="0 0 24 24"
                        strokeWidth={1}
                        stroke={
                          item?.scale <= task.rate
                            ? borderColorsHex[task.rate]
                            : "currentColor"
                        }
                        className={`size-4 md:size-6 transition-all duration-400 ease-in-out ${
                          item?.scale <= task.rate
                            ? "scale-105"
                            : "opacity-60"
                        }`}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                        />
                      </svg>
                    </button>
                  </Tooltip>
                ))}
                <div className="text-lg md:text-xl px-2 opacity-60">
                  {task.rate}
                </div>
              </div>
            )}
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
          <h3 className="text-lg font-semibold mb-2">Notice</h3>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
            {notice ?? ""}
          </p>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setNotice(null)}>
              OK
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AudioCard;
