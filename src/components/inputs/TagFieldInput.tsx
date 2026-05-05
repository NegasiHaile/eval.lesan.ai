"use client";
import SelectTransparent from "./SelectTransparent";
import { TagFieldTypes } from "@/types/data";

type TagFieldInputProps = {
  field: TagFieldTypes;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  disabled?: boolean;
  isInvalid?: boolean;
};

const TagFieldInput = ({
  field,
  value,
  onChange,
  disabled = false,
  isInvalid = false,
}: TagFieldInputProps) => {
  const labelEl = (
    <label className="text-sm font-medium font-mono flex items-center gap-1">
      {field.label}
      {field.required && <span className="text-red-500">*</span>}
      {isInvalid && (
        <span className="text-xs text-red-500 ml-1">required</span>
      )}
    </label>
  );

  if (field.multi) {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    const toggle = (option: string) => {
      if (disabled) return;
      const next = selected.includes(option)
        ? selected.filter((v) => v !== option)
        : [...selected, option];
      onChange(next);
    };
    return (
      <div className="w-full space-y-1">
        {labelEl}
        <div
          className={`flex flex-wrap gap-2 ${
            isInvalid ? "ring-1 ring-red-500 rounded-md p-1" : ""
          }`}
        >
          {field.options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => toggle(option)}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-transparent border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const singleValue = typeof value === "string" ? value : "";
  return (
    <div className="w-full space-y-1">
      {labelEl}
      <div
        className={isInvalid ? "ring-1 ring-red-500 rounded-md" : undefined}
      >
        <SelectTransparent
          id={`tag-${field.key}`}
          name={field.key}
          value={singleValue}
          optionsValues={["", ...field.options]}
          optionsLabels={["— Select —", ...field.options]}
          variant="outlined"
          disabled={disabled}
          searchable={field.options.length > 6}
          onChange={(e) => onChange(String(e.target.value))}
        />
      </div>
    </div>
  );
};

export default TagFieldInput;
