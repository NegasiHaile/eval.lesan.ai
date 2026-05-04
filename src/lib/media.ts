export type MediaKind = "audio" | "video";

/**
 * Best-effort, conservative inference based on the URL pathname extension.
 * This is only for UI selection (<audio> vs <video>); the proxy endpoint still
 * validates the actual remote Content-Type at runtime.
 */
export function inferRemoteMediaKind(rawUrl: string): MediaKind {
  // Blob/data URLs in this app are created by the recorder; treat those as audio.
  if (rawUrl.startsWith("blob:") || rawUrl.startsWith("data:")) return "audio";

  try {
    const u = new URL(rawUrl);
    const pathname = u.pathname.toLowerCase();
    const ext = pathname.split(".").pop() ?? "";

    // Keep this conservative to avoid misclassifying audio as video (e.g., .ogg/.webm).
    const isVideo =
      ext === "mp4" ||
      ext === "mov" ||
      ext === "m4v" ||
      ext === "ogv" ||
      ext === "mpeg" ||
      ext === "mpg" ||
      ext === "avi" ||
      ext === "mkv";

    return isVideo ? "video" : "audio";
  } catch {
    return "audio";
  }
}

