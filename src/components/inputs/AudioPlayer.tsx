"use client";

import React from "react";

export type AudioPlayerProps = {
  src?: string;
  title?: string;
  className?: string;
  /** When true, hides the download control on the native audio element. */
  nodownload?: boolean;
  /** Controls shown to the right of the player (record, stop, record-again, etc.) */
  actions?: React.ReactNode;
  /** Row below the player (e.g. save / upload) — rendered inside the card */
  footer?: React.ReactNode;
  /** When true, always render native audio controls even if `src` is empty. */
  alwaysShowControls?: boolean;
  size?: "default" | "lg";
};

const AudioPlayer = ({
  src,
  title = "Audio",
  className = "",
  nodownload = true,
  actions,
  footer,
  alwaysShowControls = false,
  size = "default",
}: AudioPlayerProps) => {
  const showAudio = Boolean(src) || alwaysShowControls;
  const isLarge = size === "lg";

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`w-full flex items-center ${
          isLarge ? "p-3 space-x-3" : "p-2 space-x-2"
        }`}
      >
        {showAudio ? (
          <audio
            key={src || "empty"}
            controls
            controlsList={nodownload ? "nodownload" : undefined}
            src={src}
            className={`w-full min-w-0 px-1 py-1 rounded-full ${
              isLarge ? "h-20" : "h-16"
            }`}
            title={title}
          >
            Your browser does not support the audio element.
          </audio>
        ) : (
          <div
            className={`w-full min-w-0 rounded-full bg-neutral-100/60 dark:bg-neutral-900/40 border border-dashed border-neutral-300/80 dark:border-neutral-700/80 ${
              isLarge ? "h-20" : "h-16"
            }`}
            aria-hidden
          />
        )}
        {actions ? (
          <div className="shrink-0 flex items-center">{actions}</div>
        ) : null}
      </div>
      {footer ? (
        <div className="px-2 pb-3 flex justify-end">{footer}</div>
      ) : null}
    </div>
  );
};

export default AudioPlayer;
