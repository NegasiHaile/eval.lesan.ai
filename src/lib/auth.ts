/**
 * Better Auth: Google Sign-In only, MongoDB, Next.js.
 * @see https://www.better-auth.com/docs
 */
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import clientPromise from "@/lib/mongodb";

const client = await clientPromise;
const db = client.db();
// Do not pass { client } to avoid transactions; transactions require a replica set.

const baseUrl =
  process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  database: mongodbAdapter(db),
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET,
  baseURL: baseUrl,
  trustedOrigins: [baseUrl],
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            prompt: "select_account",
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "user",
      },
      active: {
        type: "boolean",
        required: true,
        defaultValue: true,
      },
    },
  },
  plugins: [nextCookies()],
});

/** Session shape for our app: username (email) + role. */
export type SessionUser = { username: string; role: string };

export async function getSessionFromRequest(req: Request): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return null;
  const u = session.user as { email: string; role?: string };
  return {
    username: u.email,
    role: (u.role as string) ?? "user",
  };
}

export async function requireAuth(req: Request): Promise<SessionUser | Response> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return new Response(JSON.stringify({ message: "Unauthorized. Please sign in." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}

export async function requireRole(req: Request, allowedRoles: string[]): Promise<SessionUser | Response> {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;
  const role = session.role.toLowerCase();
  const allowed = allowedRoles.map((r) => r.toLowerCase());
  if (!allowed.includes(role)) {
    return new Response(JSON.stringify({ message: "Forbidden. Insufficient permissions." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}
