import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { LanguageTypes } from "../../types/languages";
import Button from "../utils/Button";

type SelectTypes = {
  id?: string;
  label?: string;
  name: string;
  value: string;
  options: LanguageTypes[];
  onChange: (lang: LanguageTypes) => void;
  labelClass?: string;
  selectClass?: string;
  disabled?: boolean;
  variant?: "transparent" | "default" | "outlined";
  placeholder?: string;
  allowAddLanguage?: boolean;
};

const SelectOption = ({
  id,
  label,
  name,
  value,
  options,
  onChange,
  labelClass,
  selectClass,
  disabled = false,
  variant = "default",
  placeholder = "Select",
  allowAddLanguage = false,
}: SelectTypes) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newLang, setNewLang] = useState({
    iso_name: "",
    iso_639_1: "",
    iso_639_3: "",
  });
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [dropdownDirection, setDropdownDirection] = useState<"up" | "down">(
    "down"
  );
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState<number>(300);
  const [localOptions, setLocalOptions] = useState<LanguageTypes[]>(options);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalOptions(options);
  }, [options]);

  const selected = localOptions.find(
    (opt) => opt.iso_639_3.toLowerCase() === value.toLowerCase()
  );

  const filteredOptions = localOptions.filter(
    (option) =>
      option.iso_name.toLowerCase().includes(search.toLowerCase()) ||
      option.iso_639_1.toLowerCase().includes(search.toLowerCase()) ||
      option.iso_639_3.toLowerCase().includes(search.toLowerCase())
  );

  const updateDropdownPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const preferDropDown = spaceBelow > 300 || spaceBelow > spaceAbove;
      const maxHeight = preferDropDown ? spaceBelow - 20 : spaceAbove - 20;

      setDropdownDirection(preferDropDown ? "down" : "up");
      setDropdownMaxHeight(maxHeight);
      setDropdownPos({
        top: preferDropDown
          ? rect.bottom + window.scrollY
          : rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    updateDropdownPosition();

    const handleScrollOrResize = () => updateDropdownPosition();
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    const observer = new ResizeObserver(updateDropdownPosition);
    if (containerRef.current) observer.observe(containerRef.current);
    observer.observe(document.body);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      observer.disconnect();
    };
  }, [isOpen]);

  useEffect(() => {
    if (allowAddLanguage && search && filteredOptions.length === 0) {
      setIsAdding(true);
      setNewLang({ iso_name: search, iso_639_1: "", iso_639_3: "" });
    } else {
      setIsAdding(false);
    }
  }, [search, allowAddLanguage, filteredOptions.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
        setIsAdding(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleAddLanguage = () => {
    const { iso_name, iso_639_1, iso_639_3 } = newLang;
    if (iso_name && iso_639_1 && iso_639_3) {
      const newEntry = { iso_name, iso_639_1, iso_639_3 };
      const updated = [...localOptions, newEntry];
      setLocalOptions(updated);
      onChange(newLang);
      setIsOpen(false);
      setIsAdding(false);
      setNewLang({ iso_name: "", iso_639_1: "", iso_639_3: "" });
      setSearch("");
    }
  };

  const baseStyles =
    "w-full min-w-32 py-3 text-gray-600 dark:text-gray-300 rounded-md focus:outline-none transition-colors duration-200";

  const variants: Record<NonNullable<SelectTypes["variant"]>, string> = {
    transparent: "border-0 dark:bg-gray-900 bg-white",
    default:
      "border border-gray-200 dark:border-gray-800 bg-gray-200 dark:bg-gray-800",
    outlined:
      "border-[0.5px] border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900",
  };

  const dropdown = (
    <ul
      className={`absolute mt-1 z-50 overflow-auto rounded-md shadow-xl ${variants[variant]} border text-gray-900 dark:text-white`}
      style={{
        top: dropdownDirection === "down" ? dropdownPos.top : undefined,
        bottom:
          dropdownDirection === "up"
            ? window.innerHeight - dropdownPos.top
            : undefined,
        left: dropdownPos.left,
        width: dropdownPos.width,
        maxHeight: dropdownMaxHeight,
      }}
    >
      <li className="sticky top-0 bg-inherit z-10 px-4 py-2 border-b border-gray-300/50 dark:border-gray-700/50 flex gap-2 items-center">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.stopPropagation()}
          className="w-full py-1 rounded bg-transparent text-sm focus:ring-0 focus:outline-none"
        />
        {allowAddLanguage && !isAdding && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsAdding(true);
            }}
            className="text-blue-500 hover:text-blue-700 text-xs font-medium transition cursor-pointer"
          >
            + Add
          </button>
        )}
      </li>

      {isAdding && (
        <li className="p-4 space-y-2 bg-transparent text-sm">
          {search && filteredOptions.length === 0 && (
            <div className="text-xs text-yellow-400 mb-2">
              Language with <strong className="uppercase">{search}</strong> not
              found. Please add your language here:
            </div>
          )}
          {["iso_name", "iso_639_1", "iso_639_3"].map((field) => (
            <input
              key={field}
              type="text"
              placeholder={field.replace("iso_", "").toUpperCase()}
              value={newLang[field as keyof typeof newLang]}
              onChange={(e) =>
                setNewLang((prev) => ({ ...prev, [field]: e.target.value }))
              }
              className="w-full px-2 py-2 border border-gray-200 dark:border-gray-800 rounded bg-gray-100 dark:bg-gray-800/50 focus:outline-none text-xs placeholder:opacity-50"
            />
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setIsAdding(false);
                setNewLang({ iso_name: "", iso_639_1: "", iso_639_3: "" });
              }}
              className="text-gray-500 hover:text-gray-700 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <Button
              text="Add Language"
              size="xs"
              variant="primary"
              minimal
              onClick={handleAddLanguage}
              className="!w-fit"
            />
          </div>
        </li>
      )}

      {!isAdding && filteredOptions.length > 0 && (
        <>
          {filteredOptions.map((option, index) => (
            <li
              key={index}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
                setSearch("");
              }}
              className={`px-4 py-2 cursor-pointer capitalize transition-colors duration-200 ${
                value.toLowerCase() === option.iso_639_3.toLowerCase()
                  ? "bg-white dark:bg-gray-900/60 font-semibold"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
              } flex items-center space-x-2`}
            >
              <span>{option.iso_name}</span>
              <span className="text-xs opacity-50 font-mono">
                → {option.iso_639_1}/{option.iso_639_3}
              </span>
            </li>
          ))}
        </>
      )}

      {!isAdding && filteredOptions.length === 0 && (
        <li className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
          No options found
        </li>
      )}
    </ul>
  );

  return (
    <div className="w-full flex relative items-center" ref={containerRef}>
      {label && (
        <label
          htmlFor={id ?? "select-option"}
          className={`hidden md:block md:left-3 font-medium ${
            labelClass ?? "absolute border-r-2 md:pr-3 opacity-50"
          }`}
        >
          {label}
        </label>
      )}
      <div
        id={id ?? name ?? "select-option"}
        className={`${baseStyles} ${variants[variant]} ${selectClass ?? ""} ${
          disabled ? "cursor-default" : "cursor-pointer"
        } px-3 h-12`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
      >
        <div className="flex justify-between items-center w-full">
          <span
            className={`truncate ${
              selected?.iso_name ? "" : " opacity-55 dark:opacity-70"
            }`}
          >
            {selected?.iso_name ?? placeholder}
          </span>
          <svg
            className={`w-4 h-4 ml-2 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
      {isOpen && ReactDOM.createPortal(dropdown, document.body)}
    </div>
  );
};

export default SelectOption;
