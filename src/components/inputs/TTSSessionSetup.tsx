"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Settings, X } from "lucide-react";
import type { TeleprompterFontSize } from "@/components/inputs/TeleprompterDisplay";

const PREFS_KEY = "tts_session_prefs";
const FONT_KEY = "tts_teleprompter_font_size";
const LENGTHS = [0, 5, 10, 15] as const;
const GAPS = [500, 1000, 2000] as const;
const FONTS: { value: TeleprompterFontSize; label: string }[] = [
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
  { value: "xl", label: "XL" },
];

export type TTSSessionPrefs = {
  durationMinutes: number;
  skipRecorded: boolean;
  segmentGapMs: (typeof GAPS)[number];
  showPrev: boolean;
  showNext: boolean;
  showPlayer: boolean;
  fontSize: TeleprompterFontSize;
};

const DEFAULTS: TTSSessionPrefs = {
  durationMinutes: 15,
  skipRecorded: true,
  segmentGapMs: 1000,
  showPrev: true,
  showNext: true,
  showPlayer: true,
  fontSize: "md",
};

type StoredPrefs = Partial<TTSSessionPrefs> & { stopPerClip?: boolean };

function readPrefs(): TTSSessionPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "null") as
      | StoredPrefs
      | null;
    const legacy = localStorage.getItem(FONT_KEY);
    const font =
      FONTS.some((f) => f.value === raw?.fontSize)
        ? raw!.fontSize!
        : FONTS.some((f) => f.value === legacy)
          ? (legacy as TeleprompterFontSize)
          : DEFAULTS.fontSize;
    const minutes = Number(raw?.durationMinutes);
    const stopAnytime = raw?.stopPerClip === true || minutes === 0;
    return {
      durationMinutes: stopAnytime
        ? 0
        : [5, 10, 15].includes(minutes)
          ? minutes
          : minutes === 1
            ? 5
            : 15,
      skipRecorded: raw?.skipRecorded !== false,
      segmentGapMs: GAPS.includes(raw?.segmentGapMs as (typeof GAPS)[number])
        ? (raw!.segmentGapMs as TTSSessionPrefs["segmentGapMs"])
        : 1000,
      showPrev: raw?.showPrev !== false,
      showNext: raw?.showNext !== false,
      showPlayer: raw?.showPlayer !== false,
      fontSize: font,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function useTTSSessionPrefs() {
  const [prefs, setPrefs] = useState<TTSSessionPrefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(readPrefs());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs, ready]);

  return { prefs, setPrefs };
}

const CHIP =
  "flex-1 min-w-0 rounded-lg px-1.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const CHIP_ON =
  "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm";
const CHIP_OFF =
  "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700";

function ChipRow({
  disabled,
  items,
}: {
  disabled?: boolean;
  items: { key: string; label: string; selected: boolean; onSelect: () => void }[];
}) {
  return (
    <div className="flex gap-1.5">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          disabled={disabled}
          onClick={item.onSelect}
          className={`${CHIP} ${item.selected ? CHIP_ON : CHIP_OFF}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function TTSSessionSetup({
  prefs,
  onChange,
  disabled = false,
}: {
  prefs: TTSSessionPrefs;
  onChange: (next: TTSSessionPrefs) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const patch = (next: Partial<TTSSessionPrefs>) =>
    onChange({ ...prefs, ...next });

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (
        event instanceof MouseEvent &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center size-9 rounded-lg transition-colors ${
          open
            ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-700"
            : "text-neutral-500 dark:text-neutral-400 hover:bg-white/80 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-100"
        }`}
        aria-label={open ? "Close settings" : "Open settings"}
        aria-expanded={open}
      >
        <Settings className="size-5" aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-30 w-[17.5rem] rounded-xl border border-neutral-200/90 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-[0_12px_40px_rgba(0,0,0,0.12)] overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Settings
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Close settings"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="px-3.5 py-3.5 space-y-4">
            <Section title="Length">
              <ChipRow
                disabled={disabled}
                items={LENGTHS.map((minutes) => ({
                  key: String(minutes),
                  label: minutes === 0 ? "Off" : `${minutes}m`,
                  selected: prefs.durationMinutes === minutes,
                  onSelect: () => patch({ durationMinutes: minutes }),
                }))}
              />
            </Section>
            <Section title="Navigation">
              <ChipRow
                disabled={disabled}
                items={[
                  {
                    key: "prev",
                    label: "Prev",
                    selected: prefs.showPrev,
                    onSelect: () => patch({ showPrev: !prefs.showPrev }),
                  },
                  {
                    key: "next",
                    label: "Next",
                    selected: prefs.showNext,
                    onSelect: () => patch({ showNext: !prefs.showNext }),
                  },
                  {
                    key: "skip",
                    label: "Skip",
                    selected: prefs.skipRecorded,
                    onSelect: () =>
                      patch({ skipRecorded: !prefs.skipRecorded }),
                  },
                  {
                    key: "player",
                    label: "Player",
                    selected: prefs.showPlayer,
                    onSelect: () => patch({ showPlayer: !prefs.showPlayer }),
                  },
                ]}
              />
            </Section>
            <Section title="Countdown">
              <ChipRow
                disabled={disabled}
                items={GAPS.map((ms) => ({
                  key: String(ms),
                  label: `${ms / 1000}s`,
                  selected: prefs.segmentGapMs === ms,
                  onSelect: () => patch({ segmentGapMs: ms }),
                }))}
              />
            </Section>
            <Section title="Font">
              <ChipRow
                disabled={disabled}
                items={FONTS.map((opt) => ({
                  key: opt.value,
                  label: opt.label,
                  selected: prefs.fontSize === opt.value,
                  onSelect: () => patch({ fontSize: opt.value }),
                }))}
              />
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
