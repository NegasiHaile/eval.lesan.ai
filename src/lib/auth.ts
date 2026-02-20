/**
 * Better Auth: Google, GitHub, Hugging Face sign-in, MongoDB, Next.js.
 * @see https://www.better-auth.com/docs
 */
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import getClientPromise from "@/lib/mongodb";

let _auth: ReturnType<typeof betterAuth> | undefined;

export async function getAuth() {
  if (_auth) return _auth;

  const client = await getClientPromise();
  const db = client.db();

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET environment variable is required.");
  }

  _auth = betterAuth({
    database: mongodbAdapter(db, { client }),
    secret,
    baseURL: process.env.BETTER_AUTH_URL,

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
      ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: process.env.GITHUB_CLIENT_ID,
              clientSecret: process.env.GITHUB_CLIENT_SECRET,
            },
          }
        : {}),
      ...(process.env.HUGGINGFACE_CLIENT_ID && process.env.HUGGINGFACE_CLIENT_SECRET
        ? {
            huggingface: {
              clientId: process.env.HUGGINGFACE_CLIENT_ID,
              clientSecret: process.env.HUGGINGFACE_CLIENT_SECRET,
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

  return _auth;
}

export type Auth = Awaited<ReturnType<typeof getAuth>>;

/** Session shape for our app: username (email) + role. */
export type SessionUser = { username: string; role: string };

export async function getSessionFromRequest(req: Request): Promise<SessionUser | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return null;
  const u = session.user as { email: string; role?: string; active?: boolean };

  // Block deactivated users
  if (u.active === false) return null;

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
