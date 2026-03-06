"use client";

import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL = 30_000;
const IDLE_TIMEOUT = 30_000;

export function usePresence(
  user: { username?: string } | null,
  batchId?: string
) {
  const isActive = useRef(true);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    if (!user?.username) return;

    function onActivity() {
      lastActivity.current = Date.now();
      isActive.current = true;
    }

    const events = ["mousemove", "keydown", "click", "scroll"] as const;
    for (const e of events) {
      document.addEventListener(e, onActivity, { passive: true });
    }

    function sendHeartbeat(status: "active" | "idle") {
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, batch_id: batchId ?? null }),
      }).catch(() => {});
    }

    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity.current > IDLE_TIMEOUT;
      if (idle) isActive.current = false;
      sendHeartbeat(isActive.current ? "active" : "idle");
    }, HEARTBEAT_INTERVAL);

    // Send initial heartbeat
    sendHeartbeat("active");

    function onBeforeUnload() {
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "idle", batch_id: batchId ?? null }),
        keepalive: true,
      }).catch(() => {});
    }

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      for (const e of events) {
        document.removeEventListener(e, onActivity);
      }
      clearInterval(interval);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [user?.username, batchId]);
}
