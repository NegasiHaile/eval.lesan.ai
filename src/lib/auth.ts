/**
 * Better Auth: Google, GitHub, Hugging Face sign-in, MongoDB, Next.js.
 * @see https://www.better-auth.com/docs
 */
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import clientPromise from "@/lib/mongodb";

const client = await clientPromise;
const db = client.db();
// Do not pass { client } if you wantto avoid transactions which require a replica set.

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    // Optional: if you don't provide a client, database transactions won't be enabled.
    client
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
    huggingface: {
      clientId: process.env.HUGGINGFACE_CLIENT_ID ?? "",
      clientSecret: process.env.HUGGINGFACE_CLIENT_SECRET ?? "",
    },
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
