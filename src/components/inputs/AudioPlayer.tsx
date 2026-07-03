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
};

const AudioPlayer = ({
  src,
  title = "Audio",
  className = "",
  nodownload = true,
  actions,
  footer,
}: AudioPlayerProps) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="w-full p-2 flex space-x-2 items-center">
        {src ? (
          <audio
            key={src}
            controls
            controlsList={nodownload ? "nodownload" : undefined}
            src={src}
            className="w-full min-w-0 px-1 py-1 h-16 rounded-full"
            title={title}
          >
            Your browser does not support the audio element.
          </audio>
        ) : (
          <div
            className="w-full min-w-0 h-16 rounded-full bg-neutral-100/60 dark:bg-neutral-900/40 border border-dashed border-neutral-300/80 dark:border-neutral-700/80"
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
