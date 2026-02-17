import React from "react";

type TextInputProps = {
  type: string;
  name?: string;
  value: string;
  required?: boolean;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  size?: "xs" | "sm" | "md" | "lg";
};

const sizeClassMap = {
  xs: "py-1 px-2 text-xs",
  sm: "py-2 px-3 text-sm",
  md: "py-[11px] px-4 text-base",
  lg: "py-3 px-5 text-lg",
};

const TextInput = ({
  type = "text",
  name = "",
  value = "",
  required = false,
  placeholder = "Enter text",
  onChange,
  size = "md",
}: TextInputProps) => {
  const sizeStyle = sizeClassMap[size] || sizeClassMap.md;

  return (
    <input
      type={type}
      name={name}
      value={value}
      required={required}
      placeholder={placeholder}
      onChange={onChange}
      className={`w-full bg-transparent rounded border-[0.5px] border-gray-300 dark:border-gray-800 dark:bg-gray-900 focus:border-blue-500 focus:outline-none ${sizeStyle}`}
    />
  );
};

export default TextInput;
