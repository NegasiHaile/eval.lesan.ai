import { extensionForAudioContentType } from "@/constants/transcription";

/**
 * UTC datetime filename with microsecond suffix, e.g.
 * `2026-07-01T12-34-56-789012.webm`
 */
export function referenceAudioFilename(contentType: string): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const micros = String(
    d.getMilliseconds() * 1000 + Math.floor((performance.now() % 1) * 1000)
  ).padStart(6, "0");
  const ext = extensionForAudioContentType(contentType);
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}-${p(d.getUTCMinutes())}-${p(d.getUTCSeconds())}-${micros}.${ext}`;
}
