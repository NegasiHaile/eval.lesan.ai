"use client";

import { useEffect, useState, useRef } from "react";

const POLL_INTERVAL = 60_000;

type PresenceStatus = "active" | "idle" | "away";

export function usePresenceStatus(usernames: string[]) {
  const [statuses, setStatuses] = useState<Record<string, PresenceStatus>>({});
  const usernamesKey = usernames.filter(Boolean).sort().join(",");
  const prevKey = useRef("");

  useEffect(() => {
    const unique = [...new Set(usernames.filter(Boolean))];
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
        const res = await fetch(
          `/api/presence?usernames=${unique.join(",")}`
        );
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
