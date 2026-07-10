"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { TeleprompterFontSize } from "@/components/inputs/TeleprompterDisplay";

const OPTIONS: {
  value: TeleprompterFontSize;
  label: string;
  previewClass: string;
}[] = [
  { value: "sm", label: "S", previewClass: "text-xs" },
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
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = OPTIONS.find((opt) => opt.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border border-neutral-200/90 dark:border-neutral-700/90 bg-white/95 dark:bg-neutral-900/95 px-2 sm:px-2.5 py-1 sm:py-1.5 shadow-sm backdrop-blur-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Font size"
        aria-expanded={isOpen}
      >
        <span className={`font-semibold text-neutral-700 dark:text-neutral-300 ${selectedOption?.previewClass || "text-sm"}`}>
          {selectedOption?.label || "M"}
        </span>
        <ChevronDown className="size-3.5 text-neutral-400 dark:text-neutral-500" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[100px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1">
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 transition-colors flex items-center gap-2 ${
                  value === opt.value
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span className={opt.previewClass}>{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export { OPTIONS as TELEPROMPTER_FONT_OPTIONS };
