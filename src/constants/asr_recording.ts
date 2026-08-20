export const ASR_RECORDING_LANGUAGE_KEY = "asr_recording_language";
export const ASR_REALTIME_COLLECTION = "asr-realtime";
export const ASR_RECORDING_SUBMIT_LABEL = "Submit";
export const ASR_RECORDING_HOSTING_LABEL = "Audio hosting...";
export const ASR_RECORDING_SAVING_LABEL = "Saving detail...";

export function formatRecordingDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
