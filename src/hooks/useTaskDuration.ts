"use client";

import { useEffect, useRef, useCallback } from "react";

const TICK_MS = 1_000;
const ACTIVITY_TIMEOUT = 60_000;

export function useTaskDuration(taskId: string | number | undefined) {
  const startedAt = useRef<string>("");
  const accumulated = useRef(0);
  const lastActivity = useRef(Date.now());
  const isVisible = useRef(true);
  const isFocused = useRef(true);

  // Reset on taskId change
  useEffect(() => {
    startedAt.current = new Date().toISOString();
    accumulated.current = 0;
    lastActivity.current = Date.now();
    isVisible.current = !document.hidden;
    isFocused.current = document.hasFocus();

    function onActivity() {
      lastActivity.current = Date.now();
    }

    function onVisChange() {
      isVisible.current = !document.hidden;
    }

    function onFocus() {
      isFocused.current = true;
      lastActivity.current = Date.now();
    }

    function onBlur() {
      isFocused.current = false;
    }

    const events = ["mousemove", "keydown", "click", "scroll"] as const;
    for (const e of events) {
      document.addEventListener(e, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    const interval = setInterval(() => {
      const active = Date.now() - lastActivity.current < ACTIVITY_TIMEOUT;
      if (isVisible.current && isFocused.current && active) {
        accumulated.current += TICK_MS;
      }
    }, TICK_MS);

    return () => {
      for (const e of events) {
        document.removeEventListener(e, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      clearInterval(interval);
    };
  }, [taskId]);

  const getStartedAt = useCallback(() => startedAt.current, []);
  const getActiveDurationMs = useCallback(() => accumulated.current, []);

  return { getStartedAt, getActiveDurationMs };
}
