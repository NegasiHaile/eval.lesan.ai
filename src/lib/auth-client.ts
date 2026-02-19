/**
 * Better Auth client: used in React components for sign-in, sign-up, session.
 * @see https://www.better-auth.com/docs/basic-usage
 */
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { Auth } from "@/lib/auth";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  plugins: [inferAdditionalFields<Auth>()],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
