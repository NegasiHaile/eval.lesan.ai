import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest } from "next/server";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 2;
const MAX_URL_LENGTH = 4096;

const PASSTHROUGH_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "cache-control",
  "expires",
  "etag",
  "last-modified",
] as const;

function isLoopbackOrPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isLoopbackOrPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().split("%")[0];
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:") || // link-local
    normalized.startsWith("fc") || // unique local
    normalized.startsWith("fd") || // unique local
    normalized.startsWith("::ffff:127.")
  );
}

function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isLoopbackOrPrivateIPv4(address);
  if (version === 6) return isLoopbackOrPrivateIPv6(address);
  return true;
}

async function assertPublicTarget(url: URL): Promise<void> {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Target host is not allowed.");
  }

  if (isIP(hostname) !== 0) {
    if (isBlockedAddress(hostname)) {
      throw new Error("Target IP is not allowed.");
    }
    return;
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true });
  if (!resolved.length) {
    throw new Error("Could not resolve target host.");
  }

  for (const item of resolved) {
    if (isBlockedAddress(item.address)) {
      throw new Error("Target host resolves to a blocked address.");
    }
  }
}

function validateAndParseUrl(urlParam: string): URL {
  if (!urlParam || urlParam.length > MAX_URL_LENGTH) {
    throw new Error("Invalid URL.");
  }

  const parsed = new URL(urlParam);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("URL must be http or https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Credentials in URL are not allowed.");
  }
  return parsed;
}

function sanitizeRangeHeader(rangeHeader: string | null): string {
  if (!rangeHeader) return "bytes=0-";
  const value = rangeHeader.trim();
  const isValid = /^bytes=\d*-\d*(,\d*-\d*)*$/.test(value);
  return isValid ? value : "bytes=0-";
}

async function fetchWithSafeRedirects(
  url: URL,
  range: string
): Promise<Response> {
  let current = url;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const remoteRes = await fetch(current.toString(), {
        headers: { Range: range },
        redirect: "manual",
        signal: controller.signal,
      });

      const isRedirect = [301, 302, 303, 307, 308].includes(remoteRes.status);
      if (!isRedirect) return remoteRes;

      if (redirectCount === MAX_REDIRECTS) {
        throw new Error("Too many redirects.");
      }

      const location = remoteRes.headers.get("location");
      if (!location) throw new Error("Invalid redirect response.");

      const nextUrl = validateAndParseUrl(new URL(location, current).toString());
      await assertPublicTarget(nextUrl);
      current = nextUrl;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Could not fetch remote audio.");
}

export async function proxyAudioRequest(
  req: NextRequest,
  urlParam: string
): Promise<Response> {
  try {
    const remoteUrl = validateAndParseUrl(urlParam);
    await assertPublicTarget(remoteUrl);

    const range = sanitizeRangeHeader(req.headers.get("range"));
    const remoteRes = await fetchWithSafeRedirects(remoteUrl, range);

    if (!remoteRes.ok && remoteRes.status !== 206) {
      return new Response("Error fetching remote audio", {
        status: remoteRes.status,
      });
    }

    const contentType = remoteRes.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      contentType &&
      !contentType.startsWith("audio/") &&
      !contentType.startsWith("application/octet-stream")
    ) {
      return new Response("Remote content is not audio.", { status: 415 });
    }

    const headers = new Headers();
    for (const key of PASSTHROUGH_HEADERS) {
      const value = remoteRes.headers.get(key);
      if (value) headers.set(key, value);
    }

    return new Response(remoteRes.body, {
      status: remoteRes.status,
      headers,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error streaming remote audio";
    const status = /invalid|not allowed|credentials|must be http/i.test(msg) ? 400 : 502;
    return new Response(msg, { status });
  }
}
