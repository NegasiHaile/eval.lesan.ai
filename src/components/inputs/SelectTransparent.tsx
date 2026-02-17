import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";

type SelectTypes = {
  id?: string;
  label?: string;
  name: string;
  value: string | number;
  optionsValues: (string | number)[];
  optionsLabels?: (string | number)[];
  onChange: (
    e:
      | React.ChangeEvent<HTMLSelectElement>
      | { target: { value: string | number; name: string } }
  ) => void;
  labelClass?: string;
  selectClass?: string;
  variant?: "transparent" | "default" | "outlined";
  disabled?: boolean;
};

const SelectTransparent = ({
  id,
  label,
  name,
  value,
  optionsValues,
  optionsLabels,
  onChange,
  labelClass,
  selectClass,
  variant = "default",
  disabled = false,
}: SelectTypes) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const baseStyles =
    "w-full min-w-32 py-3 text-gray-600 dark:text-gray-400 rounded-md cursor-pointer focus:outline-none transition-colors duration-200";
  const variants: Record<typeof variant, string> = {
    transparent: "border-0 dark:bg-gray-900 bg-white",
    default:
      "border border-gray-200 dark:border-gray-800 bg-gray-200 dark:bg-gray-800",
    outlined:
      "border-[0.5px] border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900",
  };

  const selectedIndex = optionsValues.findIndex((item) => item === value);
  const selectedLabel = optionsLabels
    ? optionsLabels[selectedIndex] ?? optionsValues[selectedIndex]
    : optionsValues[selectedIndex];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string | number) => {
    onChange({
      target: { name, value: optionValue },
    } as React.ChangeEvent<HTMLSelectElement>);
    setIsOpen(false);
  };

  const dropdown = (
    <ul
      className={`w-full absolute z-50 max-h-[600px] mt-1 overflow-auto rounded-md ${variants[variant]} text-gray-600 dark:text-gray-400 cursor-pointer shadow-md`}
      style={{
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        position: "absolute",
      }}
      role="listbox"
      aria-labelledby={id ?? "select-item"}
      tabIndex={-1}
    >
      {optionsValues.map((item, index) => (
        <li
          key={index}
          onClick={() => !disabled && handleSelect(item)}
          className={`w-full px-4 py-[14px] text-nowrap capitalize transition-colors duration-200
            ${
              item == value
                ? "bg-white dark:bg-gray-900 font-semibold"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          role="option"
          aria-selected={item == value}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSelect(item);
            }
          }}
        >
          {optionsLabels ? optionsLabels[index] : item}
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className="w-full md:w-fit flex relative items-center"
      ref={containerRef}
    >
      {label && (
        <label
          htmlFor={id ?? "select-item"}
          className={`bg-transparent p-0 opacity-50 ${
            labelClass ?? "absolute left-1 border-r-2 pr-2"
          }`}
        >
          {label}
        </label>
      )}

      <div
        id={id ?? name ?? "select-item"}
        className={`${baseStyles} ${variants[variant]} ${
          selectClass ?? ""
        } flex justify-between items-center px-3 h-12 min-w-32 w-full lg:max-w-[340px] ${
          disabled ? "cursor-default opacity-60" : "cursor-pointer"
        }`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) {
              setIsOpen((prev) => !prev);
            }
          }
          if (e.key === "Escape") {
            setIsOpen(false);
          }
        }}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
      >
        <span className="truncate max-w-full block">
          {selectedLabel ?? "Select"}
        </span>
        <svg
          className={`w-4 h-4 ml-2 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {isOpen && ReactDOM.createPortal(dropdown, document.body)}
    </div>
  );
};

export default SelectTransparent;
