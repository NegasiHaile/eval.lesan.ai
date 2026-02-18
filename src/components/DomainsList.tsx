"use client";

import React, { useRef } from "react";

import { Check, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";

import { domainsList } from "@/constants/others";
import Tooltip from "./utils/Tooltip";
import { DomainTypes } from "@/types/others";

type DomainsListProps = {
  domains?: DomainTypes[] | [] | undefined;
  selectedDomains: string[];
  toggleDomainSelection?: (name: string) => void;
  onRemove?: (name: string) => void;
  onEdit?: (name: string) => void;
  children?: React.ReactNode;
};

const DomainsList = ({
  domains,
  selectedDomains,
  toggleDomainSelection,
  onRemove,
  onEdit,
  children,
}: DomainsListProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: -200,
        behavior: "smooth",
      });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: 200,
        behavior: "smooth",
      });
    }
  };

  const batchDomains = domains && domains.length > 0 ? domains : domainsList;

  return (
    <div className="relative w-full overflow-visible">
      {/* Left Scroll Button */}
      <button
        onClick={scrollLeft}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-gradient-to-l from-neutral-300 to-white dark:from-neutral-700 dark:hover:from-neutral-800 dark:to-neutral-900 rounded-r-full p-1 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all duration-200 hover:scale-105 cursor-pointer"
        aria-label="Scroll left"
        type="button"
      >
        <ChevronLeft className="size-6" />
      </button>

      {/* Right Scroll Button */}
      <button
        onClick={scrollRight}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-gradient-to-r from-neutral-300 to-white dark:from-neutral-700 dark:hover:from-neutral-800 dark:to-neutral-900 rounded-l-full p-1 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all duration-200 hover:scale-105 cursor-pointer"
        aria-label="Scroll right"
        type="button"
      >
        <ChevronRight className="size-6" />
      </button>

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto px-8 relative z-0"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="flex space-x-3 w-max relative z-0 p-1">
          {batchDomains.map((domain, index) => (
            <Tooltip
              key={index}
              tooltipContent={
                <div className="font-mono space-y-3">
                  <div className="px-3 py-1 border-b border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-400">
                    {domain.name}
                  </div>
                  <div className="text-sm px-3 text-neutral-600 dark:text-neutral-400 mb-3">
                    {domain.description}
                  </div>
                  <div className="text-sm px-3 pb-3">
                    <div className="font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Subdomains:
                    </div>
                    <div className="space-x-1 text-xs space-y-1 flex flex-wrap">
                      {domain.subdomains?.map((subdomain, idx) => (
                        <div
                          key={idx}
                          className="text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded text-xs"
                        >
                          {subdomain}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              }
            >
              <button
                type="button"
                onClick={() =>
                  toggleDomainSelection
                    ? toggleDomainSelection(domain.name)
                    : {}
                }
                className={`flex items-center space-x-1 px-2 py-1 rounded text-sm font-medium transition-all duration-200 ease-in-out transform hover:scale-105
        ${
          selectedDomains.includes(domain.name)
            ? "bg-blue-800/80 text-white shadow-lg scale-105"
            : "bg-neutral-200/80 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700/70 shadow-md"
        }
        focus:outline-none focus:ring-opacity-50 cursor-pointer`}
              >
                <span className="font-mono whitespace-nowrap">
                  {domain.name} {children}
                </span>
                {selectedDomains.includes(domain.name) && (
                  <span>
                    <Check className="size-4" />
                  </span>
                )}

                {onEdit && (
                  <label
                    className="p-1 rounded-full cursor-pointer"
                    onClick={() => onEdit(domain.name)}
                    title={`Edit ${domain.name} category`}
                  >
                    <Pencil className="size-4" />
                  </label>
                )}

                {onRemove && (
                  <label
                    className="p-1 rounded-full cursor-pointer"
                    onClick={() => onRemove(domain.name)}
                    title={`Delete ${domain.name} category`}
                  >
                    <X className="size-4" />
                  </label>
                )}
              </button>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DomainsList;
