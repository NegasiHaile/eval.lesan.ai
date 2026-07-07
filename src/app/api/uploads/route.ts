export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { referenceAudioFilename } from "@/helpers/reference_audio_filename";
import {
  MAX_AUDIO_SIZE_BYTES,
  MAX_AUDIO_SIZE_MB,
  isSupportedAudioContentType,
  normalizeAudioContentType,
  supportedAudioFileTypes,
} from "@/constants/transcription";

type UploadResponse = {
  file_id: string;
  filename?: string;
  size_bytes?: number;
  content_type?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing required field: file" }, { status: 400 });
    }

    const rawType = file.type || "application/octet-stream";
    const contentType = normalizeAudioContentType(rawType);

    if (!isSupportedAudioContentType(contentType)) {
      return NextResponse.json(
        {
          error: `Unsupported content type "${rawType}". Supported: ${supportedAudioFileTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "File is empty." }, { status: 400 });
    }

    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_AUDIO_SIZE_MB}MB.` },
        { status: 413 }
      );
    }

    const filename =
      file instanceof File && file.name
        ? file.name
        : referenceAudioFilename(contentType);

    const upstreamForm = new FormData();
    upstreamForm.append(
      "file",
      new File([file], filename, { type: contentType })
    );

    const LESAN_ASR_API_KEY = process.env.LESAN_ASR_API_KEY ?? "";
    const LESAN_ASR_API_URL =
      process.env.LESAN_ASR_API_URL ?? "https://asr.lesan.ai";

    const response = await fetch(`${LESAN_ASR_API_URL}/v1/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LESAN_ASR_API_KEY}` },
      body: upstreamForm,
      signal: AbortSignal.timeout(120_000),
    });

    const responseText = await response.text();
    let data: UploadResponse & { error?: string | { message?: string } };
    try {
      data = JSON.parse(responseText) as UploadResponse & {
        error?: string | { message?: string };
      };
    } catch {
      data = { file_id: "", error: responseText };
    }

    if (!response.ok) {
      const err = data.error;
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : typeof err === "string"
            ? err
            : "Failed to upload audio";
      return NextResponse.json({ error: message }, { status: response.status });
    }

    if (!data.file_id) {
      return NextResponse.json(
        { error: "Invalid upload response from ASR API." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      file_id: data.file_id,
      filename: data.filename ?? filename,
      size_bytes: data.size_bytes ?? file.size,
      content_type: data.content_type ?? contentType,
    });
  } catch (error) {
    console.error("[Upload API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
