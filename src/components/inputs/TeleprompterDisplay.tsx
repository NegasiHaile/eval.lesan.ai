"use client";

export type TeleprompterFontSize = "sm" | "md" | "lg" | "xl";

const fontSizeClass: Record<TeleprompterFontSize, string> = {
  sm: "text-sm sm:text-base md:text-lg",
  md: "text-base sm:text-xl md:text-2xl lg:text-3xl",
  lg: "text-lg sm:text-2xl md:text-3xl lg:text-4xl",
  xl: "text-xl sm:text-3xl md:text-4xl lg:text-5xl",
};

type TeleprompterDisplayProps = {
  text: string;
  className?: string;
  fontSize?: TeleprompterFontSize;
  isCountingDown?: boolean;
  secondsLeft?: number;
};

export default function TeleprompterDisplay({
  text,
  className = "",
  fontSize = "md",
  isCountingDown = false,
  secondsLeft = 0,
}: TeleprompterDisplayProps) {
  return (
    <div
      className={`relative flex-1 min-h-0 overflow-y-auto ${className}`}
    >
      <div className="flex min-h-full items-center justify-center px-3 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5">
        <p
          aria-hidden={isCountingDown}
          className={`${fontSizeClass[fontSize]} text-center leading-snug sm:leading-relaxed whitespace-pre-wrap font-medium text-neutral-900 dark:text-neutral-50 w-full max-w-4xl md:max-w-5xl ${
            isCountingDown ? "invisible" : ""
          }`}
        >
          {text || (
            <span className="text-lg font-mono text-neutral-400 dark:text-neutral-500">
              …
            </span>
          )}
        </p>
      </div>

      {isCountingDown && secondsLeft > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
          <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400">
            {Number.isInteger(secondsLeft) ? secondsLeft : secondsLeft.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}
