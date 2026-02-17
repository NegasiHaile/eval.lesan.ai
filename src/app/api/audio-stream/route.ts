import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const REMOTE_URL =
      "https://archive.org/download/testmp3testfile/mpthreetest.mp3";

    // Get the "range" header from the request
    const range = req.headers.get("range") || "bytes=0-";

    // Forward request to remote server with the range header
    const remoteRes = await fetch(REMOTE_URL, {
      headers: { Range: range },
    });

    if (!remoteRes.ok && remoteRes.status !== 206) {
      return new NextResponse("Error fetching remote audio", {
        status: remoteRes.status,
      });
    }

    // Pass through headers from the remote file
    const headers = new Headers();
    remoteRes.headers.forEach((value, key) => {
      headers.set(key, value);
    });

    // Stream remote audio back to the client
    return new Response(remoteRes.body, {
      status: remoteRes.status,
      headers,
    });
  } catch (err) {
    console.error(err);
    return new NextResponse("Error streaming remote audio", { status: 500 });
  }
}
