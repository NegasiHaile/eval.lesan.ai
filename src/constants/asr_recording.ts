export const ASR_RECORDING_MIN_MS = 2 * 60 * 1000;
export const ASR_RECORDING_MAX_MS = 5 * 60 * 1000;
export const ASR_RECORDING_MAX_WARNING_MS = 30 * 1000;
export const ASR_RECORDING_LANGUAGE_KEY = "asr_recording_language";
export const ASR_REALTIME_COLLECTION = "asr_realtime";
export const ASR_RECORDING_SUBMIT_LABEL = "Submit";
export const ASR_RECORDING_HOSTING_LABEL = "Audio hosting...";
export const ASR_RECORDING_SAVING_LABEL = "Saving detail...";

function minutesFromMs(ms: number): number {
  return ms / 60_000;
}

function formatMinutesValue(ms: number): string {
  const minutes = minutesFromMs(ms);
  return Number.isInteger(minutes)
    ? String(minutes)
    : String(Number(minutes.toFixed(2)));
}

function minutesUnit(ms: number): "minute" | "minutes" {
  return minutesFromMs(ms) === 1 ? "minute" : "minutes";
}

export const ASR_RECORDING_RANGE_LABEL = `${formatMinutesValue(ASR_RECORDING_MIN_MS)}–${formatMinutesValue(ASR_RECORDING_MAX_MS)} min`;

export const ASR_RECORDING_MIN_MESSAGE = `Recording must be at least ${formatMinutesValue(ASR_RECORDING_MIN_MS)} ${minutesUnit(ASR_RECORDING_MIN_MS)}.`;

export const ASR_RECORDING_MAX_MESSAGE = `Recording must be ${formatMinutesValue(ASR_RECORDING_MAX_MS)} ${minutesUnit(ASR_RECORDING_MAX_MS)} or less.`;

export function formatRecordingDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
