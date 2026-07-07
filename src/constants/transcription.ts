/** Supported audio MIME types for Lesan ASR signed uploads (reference recordings). */
export const supportedAudioFileTypes = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/m4a",
  "audio/mp4",
  "audio/flac",
  "audio/ogg",
  "audio/webm",
  "audio/aac",
] as const;

export type SupportedAudioContentType = (typeof supportedAudioFileTypes)[number];

/** Browser MediaRecorder candidates; first match must map to a supported base type. */
export const recordingMimeTypeCandidates = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
] as const;

export const MAX_AUDIO_SIZE_MB = 500;
export const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;

/** Strip codec parameters, e.g. `audio/webm;codecs=opus` → `audio/webm`. */
export function normalizeAudioContentType(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

export function isSupportedAudioContentType(mime: string): boolean {
  const base = normalizeAudioContentType(mime);
  return (supportedAudioFileTypes as readonly string[]).includes(base);
}

/** Pick a MediaRecorder MIME type whose base type the upload API accepts. */
export function pickRecordingMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const mime of recordingMimeTypeCandidates) {
    if (
      MediaRecorder.isTypeSupported(mime) &&
      isSupportedAudioContentType(mime)
    ) {
      return mime;
    }
  }
  return "audio/webm";
}

export function extensionForAudioContentType(contentType: string): string {
  const normalized = normalizeAudioContentType(contentType);
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
    "audio/flac": "flac",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/aac": "aac",
  };
  return map[normalized] ?? "webm";
}
