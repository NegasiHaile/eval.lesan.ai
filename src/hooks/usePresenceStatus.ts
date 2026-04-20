"use client";

import { useEffect, useState, useRef } from "react";

const POLL_INTERVAL = 60_000;

export type PresenceStatus = "active" | "idle" | "away";

export type PresenceEntry = { status: PresenceStatus; batch_id: string | null };

export function usePresenceStatus(usernames: string[]) {
  const [statuses, setStatuses] = useState<Record<string, PresenceEntry>>({});
  const unique = [...new Set(usernames.filter(Boolean))];
  const usernamesKey = unique.sort().join(",");
  const prevKey = useRef("");

  useEffect(() => {
    if (unique.length === 0) {
      if (prevKey.current !== "") {
        setStatuses({});
        prevKey.current = "";
      }
      return;
    }

    prevKey.current = usernamesKey;

    async function fetchStatuses() {
      try {
        const params = new URLSearchParams();
        for (const username of unique) {
          params.append("username", username);
        }
        const res = await fetch(`/api/presence?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setStatuses(data);
        }
      } catch {
        // ignore fetch errors
      }
    }

    fetchStatuses();
    const interval = setInterval(fetchStatuses, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [usernamesKey]);

  return statuses;
}
