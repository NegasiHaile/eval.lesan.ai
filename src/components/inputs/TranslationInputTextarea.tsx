import React, { useEffect, useRef } from "react";
import Button from "../utils/Button";

type TextareaTypes = {
  name: string;
  isHorizontal: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
  translate?: () => void;
  loading: boolean;
  placeholder?: string;
};

// const getBreakpoint = (width: number) => {
//   if (width >= 1536) return "2xl";
//   if (width >= 1280) return "xl";
//   if (width >= 1024) return "lg";
//   if (width >= 768) return "md";
//   if (width >= 640) return "sm";
//   return "xs";
// };

const TranslationInputTextarea = ({
  name,
  isHorizontal,
  value,
  maxLength,
  onChange,
  className,
  disabled,
  translate,
  loading,
  placeholder = "Enter text",
}: TextareaTypes) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    const resizeTextarea = () => {
      if (textarea) {
        const width = window.innerWidth;
        const is_md_screen = width >= 768;

        textarea.style.height = "auto";
        textarea.style.minHeight = is_md_screen
          ? isHorizontal
            ? `372px`
            : "236px"
          : "180px";
        textarea.style.height = `${textarea.scrollHeight + 15}px`;
      }
    };

    resizeTextarea(); // Initial call
    window.addEventListener("resize", resizeTextarea);

    return () => {
      window.removeEventListener("resize", resizeTextarea);
    };
  }, [value, isHorizontal]);

  return (
    <div className={`relative w-full text-end ${className}`}>
      <textarea
        ref={textareaRef}
        placeholder={placeholder}
        className={`w-full p-3 h-fit min-h-85 md:min-h-115 rounded-md bg-gray-50 border border-gray-300 dark:bg-gray-800/50 dark:border-gray-800/80 text-gray-700 dark:text-gray-300 focus:outline-blue-500 ${
          disabled ? "select-none" : ""
        }`}
        name={name}
        value={value}
        onChange={onChange}
        maxLength={maxLength ?? 1500}
        disabled={disabled}
        onCopy={disabled ? (e) => e.preventDefault() : undefined}
        onCut={disabled ? (e) => e.preventDefault() : undefined}
        onContextMenu={disabled ? (e) => e.preventDefault() : undefined}
        // rows={10}
        // onBlur={translate}
      />

      {/* {value.trim() && !disabled && ( */}
      <div className="w-full flex justify-end items-center space-x-3">
        <p className="opacity-50">
          {value.length}/{maxLength ?? "1500"}
        </p>
        {value.trim() && !disabled && (
          <div className="w-fit transition-all">
            <Button
              type="button"
              text={loading ? "Translating" : "Translate"}
              variant="secondary"
              outline={true}
              onClick={translate}
              loading={loading}
              className="px-5 text-sm !py-2.5 font-mono"
            />
          </div>
        )}
      </div>
      {/* )} */}
    </div>
  );
};

export default TranslationInputTextarea;
