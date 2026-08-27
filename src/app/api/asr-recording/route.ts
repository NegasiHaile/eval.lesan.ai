export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import getClientPromise from "@/lib/mongodb";
import { languages } from "@/constants/languages";
import {
  ASR_REALTIME_COLLECTION,
  ASR_RECORDING_MAX_MESSAGE,
  ASR_RECORDING_MAX_MS,
  ASR_RECORDING_MIN_MESSAGE,
  ASR_RECORDING_MIN_MS,
} from "@/constants/asr_recording";
import { LanguageTypes } from "@/types/languages";

function findSelectedLanguage(languageCode: string): LanguageTypes | undefined {
  const code = languageCode.trim().toLowerCase();
  return languages.find(
    (lang) =>
      lang.iso_639_3.toLowerCase() === code ||
      lang.iso_639_1.toLowerCase() === code
  );
}

/**
 * POST /api/asr-recording — save a hosted recording as a realtime ASR task.
 *
 * The audio itself is hosted via the shared `POST /api/uploads` route first;
 * this endpoint only stores the task document. `input` holds the stable
 * `file_id`, never a signed URL — signed URLs expire within days, while
 * `audioPlaybackSrc` resolves a file_id to `/api/media/{file_id}`, which
 * signs a fresh URL on every playback.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = (await request.json()) as {
      file_id?: string;
      language?: string;
      duration_ms?: number;
    };

    const fileId = String(body.file_id ?? "").trim();
    if (!fileId || /\s/.test(fileId)) {
      return NextResponse.json(
        { error: "Missing file_id from hosting." },
        { status: 400 }
      );
    }

    const durationMs = Number(body.duration_ms);
    if (!Number.isFinite(durationMs) || durationMs < ASR_RECORDING_MIN_MS) {
      return NextResponse.json(
        { error: ASR_RECORDING_MIN_MESSAGE },
        { status: 400 }
      );
    }
    if (durationMs > ASR_RECORDING_MAX_MS + 1000) {
      return NextResponse.json(
        { error: ASR_RECORDING_MAX_MESSAGE },
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

    const evalTask = {
      id: fileId,
      dataset_name: "realtime",
      dataset_type: "asr",
      source_language: language,
      language,
      input: fileId,
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
    // Keyed on the hosted file_id so double-submits and retries after a lost
    // response cannot create duplicate documents.
    const result = await db
      .collection(ASR_REALTIME_COLLECTION)
      .updateOne({ id: fileId }, { $setOnInsert: evalTask }, { upsert: true });

    return NextResponse.json({
      file_id: fileId,
      inserted: Boolean(result.upsertedId),
      task: evalTask,
    });
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
