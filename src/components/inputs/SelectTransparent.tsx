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
  /** Optional class for the outer wrapper (e.g. for layout/sizing in tables). */
  className?: string;
  variant?: "transparent" | "default" | "outlined";
  disabled?: boolean;
  /** When true, show a search input to filter options; search resets on select. */
  searchable?: boolean;
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
  className,
  variant = "default",
  disabled = false,
  searchable = false,
}: SelectTypes) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const baseStyles =
    "w-full min-w-32 py-3 text-neutral-600 dark:text-neutral-400 rounded-md cursor-pointer focus:outline-none transition-colors duration-200";
  const variants: Record<typeof variant, string> = {
    transparent: "border-0 dark:bg-neutral-900 bg-white",
    default:
      "border border-neutral-200 dark:border-neutral-800 bg-neutral-200 dark:bg-neutral-800",
    outlined:
      "border-[0.5px] border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900",
  };

  const selectedIndex = optionsValues.findIndex((item) => item === value);
  const selectedLabel = optionsLabels
    ? optionsLabels[selectedIndex] ?? optionsValues[selectedIndex]
    : optionsValues[selectedIndex];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
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
      if (searchable) {
        setSearchQuery("");
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    } else if (!isOpen && searchable) {
      setSearchQuery("");
    }
  }, [isOpen, searchable]);

  const handleSelect = (optionValue: string | number) => {
    if (searchable) setSearchQuery("");
    onChange({
      target: { name, value: optionValue },
    } as React.ChangeEvent<HTMLSelectElement>);
    setIsOpen(false);
  };

  const q = (searchQuery ?? "").trim().toLowerCase();
  const filteredIndices =
    searchable && q
      ? optionsValues
          .map((_, index) => index)
          .filter((index) => {
            const label = optionsLabels
              ? String(optionsLabels[index] ?? optionsValues[index])
              : String(optionsValues[index]);
            const val = String(optionsValues[index]);
            return (
              label.toLowerCase().includes(q) || val.toLowerCase().includes(q)
            );
          })
      : optionsValues.map((_, i) => i);

  const dropdown = (
    <div
      ref={dropdownRef}
      className={`w-full absolute z-50 max-h-[600px] mt-1 overflow-hidden rounded-md ${variants[variant]} text-neutral-600 dark:text-neutral-400 shadow-md flex flex-col`}
      style={{
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        position: "absolute",
      }}
      role="listbox"
      aria-labelledby={id ?? "select-item"}
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
    >
      {searchable && (
        <div className="p-2 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="w-full px-3 py-2 text-sm rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500"
            aria-label="Search options"
          />
        </div>
      )}
      <ul className="overflow-auto flex-1 cursor-pointer">
        {filteredIndices.length === 0 ? (
          <li className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
            No matches
          </li>
        ) : (
          filteredIndices.map((index) => {
            const item = optionsValues[index];
            return (
              <li
                key={index}
                onClick={() => !disabled && handleSelect(item)}
                className={`w-full px-4 py-[14px] text-nowrap capitalize transition-colors duration-200
                  ${
                    item == value
                      ? "border-y border-neutral-300 dark:border-neutral-700 font-bold"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-700"
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
            );
          })
        )}
      </ul>
    </div>
  );

  return (
    <div
      className={`w-full md:w-fit flex relative items-center ${className ?? ""}`.trim()}
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
