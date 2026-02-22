export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ url: string }> }
) {
  const { url } = await params;

  try {
    // Next.js automatically decodes the [url] dynamic route param,
    // so no additional decodeURIComponent is needed. Applying it again
    // would over-decode signed URLs (e.g. %2B → + breaking GCS signatures).
    const remoteUrl = url;

    // Get the range header from the request
    const range = req.headers.get("range") || "bytes=0-";

    // Fetch remote audio file with Range request
    const remoteRes = await fetch(remoteUrl, {
      headers: { Range: range },
    });

    if (!remoteRes.ok && remoteRes.status !== 206) {
      return new Response("Error fetching remote audio", {
        status: remoteRes.status,
      });
    }

    // Prepare headers to forward to the client
    console.log("headers", remoteRes.headers); // This console will print something like the following.
    //Header: {
    // date: 'Tue, 12 Aug 2025 09:59:56 GMT', // Date/time when the server sent this response (in GMT)
    // server: 'Apache/2.4.65 (Unix)', // Web server software and version
    // 'x-content-type-options': 'nosniff', // Prevents browsers from guessing MIME type (security)
    // upgrade: 'h2,h2c', // Server supports HTTP/2 (h2) and HTTP/2 over cleartext (h2c)
    // connection: 'Upgrade, Keep-Alive', // Keeps the TCP connection alive and offers protocol upgrade
    // 'last-modified': 'Sat, 05 Mar 2011 18:42:04 GMT', // Last time the file was modified on the server
    // etag: '"7e0238-49dc09e6bf700"', // Unique identifier for this specific version of the file
    // 'accept-ranges': 'bytes', // Server supports partial requests in byte ranges (needed for streaming/seeking)
    // 'content-length': '8258104', // Size of the file in bytes (≈ 7.88 MB)
    // 'cache-control': 'max-age=1209600', // Browser can cache this response for 1,209,600 seconds (~14 days)
    // expires: 'Tue, 26 Aug 2025 09:59:56 GMT', // Absolute expiration date/time for caching
    // 'content-range': 'bytes 0-8258103/8258104', // This chunk contains bytes 0 to 8,258,103 (inclusive) of total 8,258,104 bytes
    // 'keep-alive': 'timeout=3, max=100', // Keep TCP connection open for 3s idle, up to 100 requests
    // 'content-type': 'audio/mpeg' // MIME type indicating the file is an MP3 audio
    // }

    const headers: Record<string, string> = {};
    remoteRes.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Return the streaming response
    return new Response(remoteRes.body, {
      status: remoteRes.status,
      headers,
    });
  } catch (err) {
    console.error("Streaming error:", err);
    return new Response("Error streaming remote audio", { status: 500 });
  }
}

// Headers {
//   date: 'Tue, 12 Aug 2025 09:52:24 GMT',
//   server: 'Apache/2.4.65 (Unix)',
//   'x-content-type-options': 'nosniff',
//   upgrade: 'h2,h2c',
//   connection: 'Upgrade, Keep-Alive',
//   'last-modified': 'Sat, 05 Mar 2011 18:39:42 GMT',
//   etag: '"9bfd3f-49dc095f53780"',
//   'accept-ranges': 'bytes',
//   'content-length': '5864767',
//   'cache-control': 'max-age=1209600',
//   expires: 'Tue, 26 Aug 2025 09:52:24 GMT',
//   'content-range': 'bytes 4358144-10222910/10222911',
//   'keep-alive': 'timeout=3, max=100',
//   'content-type': 'audio/mpeg'
// }

// Headers {
//   date: 'Tue, 12 Aug 2025 09:52:25 GMT',
//   server: 'Apache/2.4.65 (Unix)',
//   'x-content-type-options': 'nosniff',
//   upgrade: 'h2,h2c',
//   connection: 'Upgrade, Keep-Alive',
//   'last-modified': 'Sat, 05 Mar 2011 18:39:42 GMT',
//   etag: '"9bfd3f-49dc095f53780"',
//   'accept-ranges': 'bytes',
//   'content-length': '5761058',
//   'cache-control': 'max-age=1209600',
//   expires: 'Tue, 26 Aug 2025 09:52:25 GMT',
//   'content-range': 'bytes 4461853-10222910/10222911',
//   'keep-alive': 'timeout=3, max=100',
//   'content-type': 'audio/mpeg'
// }
