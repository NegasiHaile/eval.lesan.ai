/**
 * Stream remote audio via GET /api/audio-stream?url=<encoded-url>.
 * Used by ASR page to proxy any remote audio URL so the browser can play it
 * without CORS. Query param avoids long paths that break on Vercel.
 * Accepts any http/https URL.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const urlParam = req.nextUrl.searchParams.get("url");
    if (!urlParam) {
      return new NextResponse("Missing 'url' query parameter.", { status: 400 });
    }

    let remoteUrl: URL;
    try {
      remoteUrl = new URL(urlParam);
    } catch {
      return new NextResponse("Invalid 'url' query parameter.", { status: 400 });
    }

    if (remoteUrl.protocol !== "https:" && remoteUrl.protocol !== "http:") {
      return new NextResponse("URL must be http or https.", { status: 400 });
    }

    const range = req.headers.get("range") || "bytes=0-";

    const remoteRes = await fetch(remoteUrl.toString(), {
      headers: { Range: range },
    });

    if (!remoteRes.ok && remoteRes.status !== 206) {
      return new NextResponse("Error fetching remote audio", {
        status: remoteRes.status,
      });
    }

    // Forward only safe/needed headers for media streaming.
    // Avoid reflecting arbitrary headers (e.g., Set-Cookie) from remote origins.
    const passthrough = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "expires",
      "etag",
      "last-modified",
    ] as const;
    const headers = new Headers();
    for (const key of passthrough) {
      const v = remoteRes.headers.get(key);
      if (v) headers.set(key, v);
    }

    return new Response(remoteRes.body, {
      status: remoteRes.status,
      headers,
    });
  } catch (err) {
    console.error(err);
    return new NextResponse("Error streaming remote audio", { status: 500 });
  }
}
