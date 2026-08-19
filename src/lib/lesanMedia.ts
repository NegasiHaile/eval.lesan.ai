type UploadResponse = {
  file_id?: string;
  filename?: string;
  size_bytes?: number;
  content_type?: string;
  file_url?: string;
  url?: string;
  error?: string | { message?: string };
};

type MediaResponse = {
  file_id?: string;
  url?: string;
  expires_in?: number;
  expires_at?: string;
  content_type?: string;
  size_bytes?: number;
  error?: string | { message?: string };
};

function lesanConfig() {
  const apiKey = process.env.LESAN_ASR_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("LESAN_ASR_API_KEY is not configured.");
  }
  return {
    apiUrl: process.env.LESAN_ASR_API_URL ?? "https://asr.lesan.ai",
    apiKey,
  };
}

function errorMessage(
  error: string | { message?: string } | undefined,
  fallback: string
): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message ?? fallback);
  }
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: text } as T;
  }
}

export async function uploadLesanMedia(file: File): Promise<{
  file_id: string;
  filename?: string;
  size_bytes?: number;
  content_type?: string;
  url?: string;
}> {
  const { apiUrl, apiKey } = lesanConfig();
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${apiUrl}/v1/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  const data = await parseJson<UploadResponse>(response);
  if (!response.ok || !data.file_id) {
    throw new Error(errorMessage(data.error, "Failed to upload audio"));
  }

  const url =
    typeof data.url === "string" && data.url.startsWith("http")
      ? data.url
      : undefined;

  return {
    file_id: data.file_id,
    filename: data.filename,
    size_bytes: data.size_bytes,
    content_type: data.content_type,
    url,
  };
}

export async function resolveLesanMedia(
  fileId: string,
  expiresIn = 604_800
): Promise<{
  file_id: string;
  url: string;
  expires_in?: number;
  expires_at?: string;
}> {
  const { apiUrl, apiKey } = lesanConfig();
  const response = await fetch(
    `${apiUrl}/v1/media/${encodeURIComponent(fileId)}?expires_in=${expiresIn}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(45_000),
    }
  );

  const data = await parseJson<MediaResponse>(response);
  if (!response.ok || !data.url) {
    throw new Error(errorMessage(data.error, "Failed to resolve media URL"));
  }

  return {
    file_id: data.file_id ?? fileId,
    url: data.url,
    expires_in: data.expires_in,
    expires_at: data.expires_at,
  };
}
