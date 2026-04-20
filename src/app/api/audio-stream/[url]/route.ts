export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { proxyAudioRequest } from "@/lib/audioProxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ url: string }> }
) {
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { url: urlParam } = await params;

  try {
    // Legacy path-based route; prefer /api/audio-stream?url=<encoded-url>.
    return proxyAudioRequest(req, urlParam);
  } catch (err) {
    console.error("Streaming error:", err);
    return new Response("Error streaming remote audio", { status: 500 });
  }
}
