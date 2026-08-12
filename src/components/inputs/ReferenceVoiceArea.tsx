"use client";

import { Mic, Square } from "lucide-react";

const WAVEFORM_BARS = 40;

type SessionReferenceVoiceAreaProps = {
  inCaptureMode: boolean;
  levels: number[];
  isLastTask: boolean;
  saving?: boolean;
  preparingSession?: boolean;
  disabled?: boolean;
  className?: string;
  onStart: () => void;
  onStop: () => void;
};

function WaveformSide({
  bars,
  active,
  align,
}: {
  bars: number[];
  active: boolean;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex flex-1 items-center gap-[1px] sm:gap-[2px] md:gap-[3px] h-10 sm:h-12 md:h-14 min-w-0 max-w-[40%] sm:max-w-none ${
        align === "left" ? "justify-end" : "justify-start"
      }`}
    >
      {bars.map((level, i) => (
        <span
          key={i}
          className={`w-[2px] sm:w-[3px] shrink-0 rounded-full transition-[height] duration-75 ${
            active
              ? "bg-rose-400 dark:bg-rose-400"
              : "bg-neutral-300 dark:bg-neutral-600"
          }`}
          style={{ height: `${Math.round(level * 100)}%` }}
        />
      ))}
    </div>
  );
}

export default function ReferenceVoiceArea({
  inCaptureMode,
  levels,
  isLastTask,
  saving = false,
  preparingSession = false,
  disabled = false,
  className = "",
  onStart,
  onStop,
}: SessionReferenceVoiceAreaProps) {
  const half = Math.floor(levels.length / 2);
  const leftLevels = levels.slice(0, half).reverse();
  const rightLevels = levels.slice(half);

  return (
    <div className={`flex items-center justify-center gap-2 sm:gap-4 md:gap-6 w-full max-w-md sm:max-w-xl mx-auto px-2 sm:px-0 py-1 ${className}`}>
      <WaveformSide bars={leftLevels} active={inCaptureMode} align="left" />

      {!inCaptureMode ? (
        <button
          type="button"
          onClick={onStart}
          disabled={disabled || saving}
          className="relative shrink-0 size-12 sm:size-14 md:size-16 rounded-full bg-white dark:bg-neutral-900 text-red-500 shadow-[0_4px_20px_rgba(0,0,0,0.12)] ring-1 ring-neutral-200/80 dark:ring-neutral-700 transition hover:shadow-[0_6px_24px_rgba(0,0,0,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
          title={saving ? "Saving…" : "Start recording"}
          aria-label={saving ? "Saving recording" : "Start recording"}
        >
          {saving && (
            <span
              className="absolute inset-0 rounded-full border-2 border-red-400 border-t-transparent animate-spin"
              aria-hidden
            />
          )}
          <Mic
            className={`size-6 sm:size-7 mx-auto relative z-10 ${
              saving ? "opacity-60" : ""
            }`}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={isLastTask ? onStop : undefined}
          disabled={!isLastTask || saving || preparingSession || disabled}
          className={`relative shrink-0 size-12 sm:size-14 md:size-16 rounded-full transition shadow-[0_0_0_6px_rgba(244,63,94,0.2)] sm:shadow-[0_0_0_8px_rgba(244,63,94,0.2)] disabled:cursor-not-allowed ${
            isLastTask
              ? "bg-red-500 hover:bg-red-600 cursor-pointer disabled:opacity-100"
              : "bg-red-500/80 cursor-default"
          }`}
          title={
            saving
              ? "Saving…"
              : isLastTask
                ? "Stop and finish"
                : "Recording in progress"
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
            className={`size-5 sm:size-6 text-white fill-white mx-auto relative z-10 ${
              saving || !isLastTask ? "opacity-60" : ""
            }`}
          />
        </button>
      )}

      <WaveformSide bars={rightLevels} active={inCaptureMode} align="right" />
    </div>
  );
}

export { WAVEFORM_BARS };
