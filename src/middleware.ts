import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PATHS = ["/profile", "/users", "/datasets"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  // Use a lightweight cookie check instead of importing the full auth
  // library, which requires Node.js crypto and breaks in the Edge Runtime.
  // Actual session validation still happens server-side in API routes.
  // In production (HTTPS), better-auth prefixes cookies with __Secure-.
  const sessionToken =
    request.cookies.get("__Secure-better-auth.session_token") ||
    request.cookies.get("better-auth.session_token");

  if (!sessionToken?.value) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/profile",
    "/profile/:path*",
    "/users",
    "/users/:path*",
    "/datasets",
    "/datasets/:path*",
  ],
};
