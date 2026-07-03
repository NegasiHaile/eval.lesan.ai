export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { proxyAudioRequest } from "@/lib/audioProxy";

type RouteParams = {
  fileId: string;
};

/** GET /v1/media/{file_id} → signed URL, then stream for playback. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const { fileId } = await params;
    const id = decodeURIComponent(fileId).trim();
    if (!id) {
      return new NextResponse("Missing file_id.", { status: 400 });
    }

    const LESAN_ASR_API_KEY = process.env.LESAN_ASR_API_KEY ?? "";
    const LESAN_ASR_API_URL =
      process.env.LESAN_ASR_API_URL ?? "https://asr.lesan.ai";

    const res = await fetch(
      `${LESAN_ASR_API_URL}/v1/media/${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${LESAN_ASR_API_KEY}` },
        signal: AbortSignal.timeout(45_000),
      }
    );

    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      return new NextResponse(data.error ?? "Failed to resolve media.", {
        status: res.ok ? 502 : res.status,
      });
    }

    return proxyAudioRequest(req, data.url);
  } catch (err) {
    console.error("[Media API] Error:", err);
    return new NextResponse("Error streaming media", { status: 502 });
  }
}
