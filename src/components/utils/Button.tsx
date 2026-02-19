import React from "react";
import { Loader2 } from "lucide-react";

type ButtonTypes = {
  type?: "button" | "submit" | "reset";
  loading?: boolean;
  text?: string;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: "primary" | "secondary" | "success" | "danger" | "transparent";
  outline?: boolean;
  minimal?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  children?: React.ReactNode;
};

const sizeClassMap = {
  xs: "py-1 px-2 text-xs",
  sm: "py-2 px-3 text-sm",
  md: "py-[11px] px-4 text-base",
  lg: "py-3.5 px-6 text-lg",
};

const baseClass =
  "w-full flex items-center justify-center rounded-md transition";

const variantClassMap = {
  primary: {
    solid: "bg-blue-500 hover:bg-blue-700 text-white hover:text-neutral-200",
    outline:
      "border border-blue-500 text-blue-600 hover:bg-blue-600 hover:text-white",
    minimal: "bg-transparent text-blue-600 hover:text-blue-800",
  },
  secondary: {
    solid: "bg-neutral-300 dark:bg-neutral-800 hover:bg-neutral-800/80 hover:text-white",
    outline:
      "border border-neutral-300 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white",
    minimal:
      "bg-transparent text-neutral-700 dark:text-neutral-200 hover:text-black dark:hover:text-white",
  },
  success: {
    solid: "bg-green-600 hover:bg-green-700 text-neutral-50 hover:text-white",
    outline:
      "border border-green-500 text-green-500 hover:bg-green-500 hover:text-white",
    minimal: "bg-transparent text-green-600 hover:text-green-800",
  },
  danger: {
    solid: "bg-red-600 hover:bg-red-700 text-neutral-50 hover:text-white",
    outline:
      "border border-red-500 text-red-500 hover:bg-red-500 hover:text-white",
    minimal: "bg-transparent text-red-600 hover:text-red-800",
  },
  transparent: {
    solid:
      "bg-transparent text-inherit hover:bg-neutral-100 dark:hover:bg-neutral-900",
    outline:
      "bg-transparent border border-transparent text-inherit hover:border-neutral-200 dark:hover:border-neutral-800",
    minimal: "bg-transparent text-inherit hover:underline",
  },
};

const Button = ({
  type = "submit",
  loading = false,
  text,
  title = "",
  onClick,
  variant = "primary",
  outline = false,
  minimal = false,
  size = "md",
  className = "",
  children,
}: ButtonTypes) => {
  const variantStyle = variantClassMap[variant] || variantClassMap.primary;
  const finalStyle = minimal
    ? variantStyle.minimal
    : outline
    ? variantStyle.outline
    : variantStyle.solid;
  const sizeStyle = sizeClassMap[size] || sizeClassMap.md;

  return (
    <button
      type={type}
      onClick={onClick}
      className={`flex items-center justify-center space-x-1 ${baseClass} ${sizeStyle} ${
        loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${finalStyle} ${className}`}
      disabled={loading}
      title={title}
    >
      {children}
      {loading && <Loader2 className="size-5 shrink-0 animate-spin" />}
      <p>{text}</p>
    </button>
  );
};

export default Button;
