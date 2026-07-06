"use client";

type TeleprompterDisplayProps = {
  text: string;
  className?: string;
  isCountingDown?: boolean;
  secondsLeft?: number;
};

export default function TeleprompterDisplay({
  text,
  className = "",
  isCountingDown = false,
  secondsLeft = 0,
}: TeleprompterDisplayProps) {
  return (
    <div
      className={`relative flex items-center justify-center min-h-[22vh] sm:min-h-[26vh] md:min-h-[32vh] px-4 py-5 sm:px-6 sm:py-8 md:p-10 ${className}`}
    >
      <p
        className={`text-lg sm:text-2xl md:text-3xl lg:text-4xl text-center leading-snug sm:leading-relaxed whitespace-pre-wrap font-medium text-neutral-900 dark:text-neutral-50 transition-opacity duration-300 w-full max-w-3xl ${
          isCountingDown ? "opacity-30" : "opacity-100"
        }`}
      >
        {text || (
          <span className="text-lg font-mono text-neutral-400 dark:text-neutral-500">
            …
          </span>
        )}
      </p>

      {isCountingDown && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
          <span className="text-4xl sm:text-5xl md:text-6xl font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {secondsLeft}
          </span>
        </div>
      )}
    </div>
  );
}
