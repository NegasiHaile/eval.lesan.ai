"use client";

import { Mic, Square } from "lucide-react";
import { audioPlaybackSrc } from "@/helpers/audio_playback_url";

const WAVEFORM_BARS = 40;

type SessionReferenceVoiceAreaProps = {
  inCaptureMode: boolean;
  levels: number[];
  isLastTask: boolean;
  saving?: boolean;
  preparingSession?: boolean;
  disabled?: boolean;
  value?: string;
  onStart: () => void;
  onStop: () => void;
};

export default function ReferenceVoiceArea({
  inCaptureMode,
  levels,
  isLastTask,
  saving = false,
  preparingSession = false,
  disabled = false,
  value,
  onStart,
  onStop,
}: SessionReferenceVoiceAreaProps) {
  const savedPlaybackSrc = value ? audioPlaybackSrc(value) : undefined;

  return (
    <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
      <div className="flex items-end gap-2 sm:gap-3 min-w-0">
        <div className="flex-1 min-w-0 flex items-end justify-center gap-[2px] sm:gap-[3px] h-12 sm:h-14 overflow-hidden">
          {savedPlaybackSrc && !inCaptureMode && !saving ? (
            <audio
              key={savedPlaybackSrc}
              controls
              src={savedPlaybackSrc}
              className="w-full min-w-0 h-9 sm:h-10"
              title="Segment recording"
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

        {!inCaptureMode ? (
          <button
            type="button"
            onClick={onStart}
            disabled={disabled || saving}
            className="relative shrink-0 p-2.5 sm:p-3 rounded-full text-white bg-red-500 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-100"
            title={saving ? "Saving…" : "Start recording"}
            aria-label={saving ? "Saving recording" : "Start recording"}
          >
            {saving && (
              <span
                className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"
                aria-hidden
              />
            )}
            <Mic
              className={`size-5 relative z-10 ${saving ? "opacity-60" : ""}`}
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={isLastTask ? onStop : undefined}
            disabled={!isLastTask || saving || preparingSession || disabled}
            className={`relative shrink-0 p-2.5 sm:p-3 rounded-full transition disabled:cursor-not-allowed ${
              isLastTask
                ? "bg-red-600 hover:bg-red-500 cursor-pointer disabled:opacity-100"
                : "bg-red-600/60 cursor-default"
            }`}
            title={
              saving
                ? "Saving…"
                : isLastTask
                  ? "Stop and finish"
                  : "Stop on last segment"
            }
            aria-label={
              saving
                ? "Saving recording"
                : isLastTask
                  ? "Stop recording"
                  : "Recording in progress"
            }
          >
            {saving && (
              <span
                className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"
                aria-hidden
              />
            )}
            <Square
              className={`size-5 text-white fill-white relative z-10 ${
                saving || !isLastTask ? "opacity-60" : ""
              }`}
            />
          </button>
        )}
      </div>
    </div>
  );
}

export { WAVEFORM_BARS };
