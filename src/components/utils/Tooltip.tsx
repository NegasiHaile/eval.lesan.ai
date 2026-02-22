"use client";

import { usePreferences } from "@/context/PreferencesContext";
import React, { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

type TooltipProps = {
  pointerStyle?: string | null;
  children: React.ReactNode;
  tooltipContent: React.ReactNode;
};

const Tooltip = ({
  pointerStyle = null,
  children,
  tooltipContent,
}: TooltipProps) => {
  const { showTooltips } = usePreferences();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const showTooltip = (e: React.MouseEvent) => {
    cancelHide();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const hideTooltip = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setPosition(null);
    }, 150);
  };

  useEffect(() => {
    return () => cancelHide();
  }, [cancelHide]);

  return (
    <div
      className="relative"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      {showTooltips &&
        position &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            className="absolute top-0 z-50 w-full max-w-70 bg-gradient-to-b from-neutral-100 to-neutral-200 dark:from-neutral-700 dark:via-neutral-800 dark:to-neutral-900 rounded-lg shadow-lg animate-fade-in"
            style={{
              left: position.x,
              top: position.y - 12,
              transform: "translate(-50%, -100%)",
              position: "fixed",
            }}
            onMouseEnter={cancelHide}
            onMouseLeave={hideTooltip}
          >
            {tooltipContent}

            {/* Triangle Arrow */}
            <div
              className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"
              style={{ marginTop: "2px" }}
            >
              <div
                className={`w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent ${
                  pointerStyle ?? `border-t-neutral-300 dark:border-t-neutral-800`
                }`}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default Tooltip;
