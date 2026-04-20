"use client";

import { Dispatch, useState, SetStateAction } from "react";
import Modal from "./utils/Modal";
import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";
import Image from "next/image";

type SocialProvider = "google" | "github" | "huggingface";

const PROVIDERS: {
  id: SocialProvider;
  label: string;
  iconSrc: string;
}[] = [
  { id: "google", label: "Google", iconSrc: "/google-color-icon.svg" },
  { id: "github", label: "GitHub", iconSrc: "/github-icon.svg" },
  { id: "huggingface", label: "Hugging Face", iconSrc: "/huggingface-icon.svg" },
];

type ModalProps = {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
};

type Mode = "signin" | "signup" | "forgot";

export default function Signup({ isOpen, setIsOpen }: ModalProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSignInSocial = async (provider: SocialProvider) => {
    setLoading(provider);
    setError(null);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: "/",
      });
    } catch (err) {
      console.error(`${provider} sign-in error:`, err);
      setError("Sign-in failed. Please try again.");
      setLoading(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setForgotSuccess(false);
    if (mode === "forgot") {
      setLoading("email");
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/reset-password` : "/reset-password";
      const { error: err } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo,
      });
      setLoading(null);
      if (err) {
        setError(err.message ?? "Could not send reset link.");
        return;
      }
      setForgotSuccess(true);
      return;
    }
    if (mode === "signin") {
      setLoading("email");
      const { error: err } = await authClient.signIn.email(
        {
          email: email.trim(),
          password,
          callbackURL: "/",
        },
        {
          onError: (ctx) => {
            if (ctx.error.status === 403) {
              setError("Please verify your email first. Check your inbox for the verification link.");
            } else {
              setError(ctx.error.message ?? "Sign in failed.");
            }
          },
        }
      );
      setLoading(null);
      if (err) {
        setError(
          err.status === 403
            ? "Please verify your email first. Check your inbox for the verification link."
            : (err.message ?? "Sign in failed.")
        );
        return;
      }
      setIsOpen(false);
    } else {
      setLoading("email");
      const { error: err } = await authClient.signUp.email({
        name: name.trim() || email.split("@")[0],
        email: email.trim(),
        password,
        callbackURL: "/",
      });
      setLoading(null);
      if (err) {
        setError(err.message ?? "Sign up failed.");
        return;
      }
      setIsOpen(false);
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    setLoading(null);
    setError(null);
    setForgotSuccess(false);
    setEmail("");
    setPassword("");
    setName("");
  };

  const backFromForgot = () => {
    setMode("signin");
    setError(null);
    setForgotSuccess(false);
  };

  return (
    <Modal isOpen={isOpen} setIsOpen={closeModal}>
      <div className="p-8 rounded-lg w-full md:min-w-[400px] max-w-[440px] text-center">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-white mb-6">
          {mode === "forgot" ? "Reset password" : mode === "signin" ? "Sign in" : "Create account"}
        </h1>

        {forgotSuccess ? (
          <div className="text-left space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              If an account exists for <strong className="text-neutral-900 dark:text-white">{email}</strong>, you will receive an email with a link to reset your password. Check your inbox and spam folder.
            </p>
            <button
              type="button"
              onClick={backFromForgot}
              className="text-sm font-medium text-primary hover:underline"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            {mode !== "forgot" && (
              <div className="flex flex-col gap-2 mb-6">
                {PROVIDERS.map(({ id, label, iconSrc }) => (
                  <button
                    key={id}
                    type="button"
                    disabled={!!loading}
                    onClick={() => handleSignInSocial(id)}
                    className="w-full flex items-center justify-center gap-2.5 rounded-lg py-2.5 px-4 text-sm font-medium border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading === id ? (
                      <Loader2 className="shrink-0 size-5 animate-spin" aria-hidden />
                    ) : (
                      <Image src={iconSrc} alt="" width={20} height={20} className="shrink-0" aria-hidden />
                    )}
                    <span>{mode === "signin" ? "Continue with" : "Sign up with"} {label}</span>
                  </button>
                ))}
              </div>
            )}

            {mode !== "forgot" && (
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-neutral-200 dark:border-neutral-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white dark:bg-neutral-900 px-2 text-neutral-500 dark:text-neutral-400">
                    {mode === "signin" ? "Or sign in with email" : "Or sign up with email"}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="text-left space-y-4">
              {mode === "forgot" && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>
              )}
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <label htmlFor="name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2.5 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                    placeholder="Your name"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2.5 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                  placeholder="you@example.com"
                />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2.5 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                    placeholder={mode === "signin" ? "Your password" : "At least 8 characters"}
                  />
                </div>
              )}
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={!!loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg py-3 px-4 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading === "email" ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <span>{mode === "forgot" ? "Send reset link" : mode === "signin" ? "Sign in" : "Create account"}</span>
                )}
              </button>
              {mode === "signin" && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(null); }}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              {mode === "forgot" && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={backFromForgot}
                    className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:underline"
                  >
                    Back to sign in
                  </button>
                </div>
              )}
            </form>

            {(mode === "signin" || mode === "signup") && (
              <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {mode === "signin" ? (
                    <>
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => { setMode("signup"); setError(null); }}
                        className="font-medium text-primary hover:underline"
                      >
                        Sign up here
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => { setMode("signin"); setError(null); }}
                        className="font-medium text-primary hover:underline"
                      >
                        Sign in here
                      </button>
                    </>
                  )}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
