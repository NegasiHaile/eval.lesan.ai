"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";
import Container from "@/components/utils/Container";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const errorParam = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (errorParam === "INVALID_TOKEN") {
    return (
      <Container>
        <div className="w-full max-w-md mx-auto py-12 text-center">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
            Invalid or expired link
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-6">
            This password reset link is invalid or has expired. Request a new one from the sign-in page.
          </p>
          <Link
            href="/"
            className="text-primary hover:underline font-medium"
          >
            Back to home
          </Link>
        </div>
      </Container>
    );
  }

  if (!token) {
    return (
      <Container>
        <div className="w-full max-w-md mx-auto py-12 text-center">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
            Reset your password
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-6">
            Use the link from your email to set a new password. If you didn&apos;t receive it, check spam or request a new link from sign-in.
          </p>
          <Link
            href="/"
            className="text-primary hover:underline font-medium"
          >
            Back to home
          </Link>
        </div>
      </Container>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const { error: err } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setLoading(false);
    if (err) {
      setError(err.message ?? "Failed to reset password. The link may have expired.");
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <Container>
        <div className="w-full max-w-md mx-auto py-12 text-center">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
            Password reset
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-6">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <Link
            href="/"
            className="inline-block rounded-md py-2.5 px-4 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Sign in
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="w-full max-w-md mx-auto py-12">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2 text-center">
          Set new password
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-6 text-center">
          Enter your new password below.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Repeat password"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-md py-2.5 px-4 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              "Reset password"
            )}
          </button>
        </form>
      </div>
    </Container>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center min-h-[40vh]">
          <p className="text-neutral-600 dark:text-neutral-400">Loading...</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
