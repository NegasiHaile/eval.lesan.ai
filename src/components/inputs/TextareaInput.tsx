import React from "react";

type TextareaInputProps = {
  name?: string;
  value: string;
  required?: boolean;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  size?: "xs" | "sm" | "md" | "lg";
  rows?: number;
  className?: string;
};

const sizeClassMap = {
  xs: "py-1 px-2 text-xs",
  sm: "py-2 px-3 text-sm",
  md: "py-[11px] px-4 text-base",
  lg: "py-3 px-5 text-lg",
};

const TextareaInput = ({
  name = "",
  value = "",
  required = false,
  placeholder = "Enter text",
  onChange,
  size = "md",
  rows = 4,
  className,
}: TextareaInputProps) => {
  const sizeStyle = sizeClassMap[size] || sizeClassMap.md;

  return (
    <textarea
      name={name}
      value={value}
      required={required}
      placeholder={placeholder}
      onChange={onChange}
      rows={rows}
      className={`w-full bg-transparent rounded border-[0.5px] border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 focus:border-blue-500 focus:outline-none resize-none ${sizeStyle} ${className}`}
    />
  );
};

export default TextareaInput;
