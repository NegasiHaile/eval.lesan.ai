export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, type SessionUser } from "@/lib/auth";
import getClientPromise from "@/lib/mongodb";
import { resolveLesanMedia, uploadLesanMedia } from "@/lib/lesanMedia";
import { referenceAudioFilename } from "@/helpers/reference_audio_filename";
import { languages } from "@/constants/languages";
import { ASR_REALTIME_COLLECTION } from "@/constants/asr_recording";
import {
  MAX_AUDIO_SIZE_BYTES,
  MAX_AUDIO_SIZE_MB,
  isSupportedAudioContentType,
  normalizeAudioContentType,
  supportedAudioFileTypes,
} from "@/constants/transcription";
import { LanguageTypes } from "@/types/languages";

function findSelectedLanguage(languageCode: string): LanguageTypes | undefined {
  const code = languageCode.trim().toLowerCase();
  return languages.find(
    (lang) =>
      lang.iso_639_3.toLowerCase() === code ||
      lang.iso_639_1.toLowerCase() === code
  );
}

async function hostRecording(formData: FormData) {
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: "Missing required field: file" },
      { status: 400 }
    );
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

  const upload = await uploadLesanMedia(
    new File([file], filename, { type: contentType })
  );

  return NextResponse.json({
    file_id: upload.file_id,
  });
}

async function saveRecording(
  auth: SessionUser,
  body: {
    file_id?: string;
    language?: string;
    duration_ms?: number;
  }
) {
  const fileId = String(body.file_id ?? "").trim();
  const durationMs = Number(body.duration_ms);

  if (!fileId || fileId.includes(" ")) {
    return NextResponse.json(
      { error: "Missing file_id from hosting." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return NextResponse.json(
      { error: "Missing or invalid duration_ms." },
      { status: 400 }
    );
  }

  const language = findSelectedLanguage(String(body.language ?? ""));
  if (!language) {
    return NextResponse.json(
      { error: "Select a valid language." },
      { status: 400 }
    );
  }

  const media = await resolveLesanMedia(fileId);
  if (!media.url.startsWith("https://") && !media.url.startsWith("http://")) {
    return NextResponse.json(
      { error: "Invalid media URL from hosting." },
      { status: 502 }
    );
  }

  const evalTask = {
    id: media.file_id,
    dataset_name: "realtime",
    dataset_type: "asr",
    source_language: language,
    language,
    input: media.url,
    models: [
      {
        output: "",
        model: "A",
        rate: 0,
        rank: 0,
      },
    ],
    human_correction: "",
    duration_ms: Math.round(durationMs),
    created_at: new Date().toISOString(),
    created_by: auth.username,
  };

  const client = await getClientPromise();
  const db = client.db();
  const result = await db.collection(ASR_REALTIME_COLLECTION).insertOne(evalTask);

  return NextResponse.json({
    insertedId: result.insertedId,
    file_id: media.file_id,
    url: media.url,
    task: evalTask,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        file_id?: string;
        language?: string;
        duration_ms?: number;
      };
      return await saveRecording(auth, body);
    }

    const formData = await request.formData();
    return await hostRecording(formData);
  } catch (error) {
    console.error("[ASR recording] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save recording.",
      },
      { status: 500 }
    );
  }
}
