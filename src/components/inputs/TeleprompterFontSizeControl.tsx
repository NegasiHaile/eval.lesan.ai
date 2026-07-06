"use client";

import { Type } from "lucide-react";
import { TeleprompterFontSize } from "@/components/inputs/TeleprompterDisplay";

const OPTIONS: {
  value: TeleprompterFontSize;
  label: string;
  previewClass: string;
}[] = [
  { value: "sm", label: "S", previewClass: "text-[11px]" },
  { value: "md", label: "M", previewClass: "text-sm" },
  { value: "lg", label: "L", previewClass: "text-base" },
];

type TeleprompterFontSizeControlProps = {
  value: TeleprompterFontSize;
  onChange: (value: TeleprompterFontSize) => void;
  disabled?: boolean;
};

export default function TeleprompterFontSizeControl({
  value,
  onChange,
  disabled = false,
}: TeleprompterFontSizeControlProps) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-xl border border-neutral-200/90 dark:border-neutral-700/90 bg-white/95 dark:bg-neutral-900/95 px-2 py-1.5 shadow-sm backdrop-blur-sm"
      role="group"
      aria-label="Teleprompter font size"
    >
      <Type
        className="size-3.5 text-neutral-400 dark:text-neutral-500 shrink-0"
        aria-hidden
      />

      <div className="flex rounded-lg bg-neutral-100/90 dark:bg-neutral-800/90 p-0.5 gap-0.5">
        {OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              aria-pressed={isActive}
              title={`Font size ${opt.label}`}
              className={`relative min-w-[2.25rem] h-7 rounded-md font-semibold leading-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${opt.previewClass} ${
                isActive
                  ? "bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-700/80"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-white/50 dark:hover:bg-neutral-900/40"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { OPTIONS as TELEPROMPTER_FONT_OPTIONS };
