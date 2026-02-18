import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PROTECTED_PATHS = ["/profile", "/users", "/datasets"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
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
