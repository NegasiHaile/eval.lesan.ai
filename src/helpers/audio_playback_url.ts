/**
 * Resolve a stored audio URL/path for HTML `<audio>` playback.
 * - `file_id` (TTS reference) → /api/media/{file_id}
 * - Local paths served as-is
 * - Remote http(s) URLs proxied via /api/audio-stream
 */
export function audioPlaybackSrc(
  rawUrl: string | undefined | null
): string | undefined {
  if (!rawUrl?.trim()) return undefined;

  const url = rawUrl.trim();

  if (url.startsWith("blob:") || url.startsWith("/")) {
    return url;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `/api/audio-stream?url=${encodeURIComponent(url)}`;
  }

  if (url.includes(" ")) {
    return undefined;
  }

  return `/api/media/${encodeURIComponent(url)}`;
}
