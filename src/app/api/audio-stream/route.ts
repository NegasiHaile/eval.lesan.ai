/**
 * Stream remote audio via GET /api/audio-stream?url=<encoded-url>.
 * Used by ASR page to proxy any remote audio URL so the browser can play it
 * without CORS. Query param avoids long paths that break on Vercel.
 * Accepts any http/https URL.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { proxyAudioRequest } from "@/lib/audioProxy";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const urlParam = req.nextUrl.searchParams.get("url");
    if (!urlParam) {
      return new NextResponse("Missing 'url' query parameter.", { status: 400 });
    }
    return proxyAudioRequest(req, urlParam);
  } catch (err) {
    console.error(err);
    return new NextResponse("Error streaming remote audio", { status: 500 });
  }
}
