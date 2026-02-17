"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/utils/Button";
import TextInput from "@/components/inputs/TextInput";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  // New state to track if the password reset was successful
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }

    fetch(`/api/auth/verify-token?token=${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("Verification request failed");
        return res.json();
      })
      .then((data) => setTokenValid(data.valid))
      .catch(() => setTokenValid(false));
  }, [token, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to reset password.");
        setLoading(false);
        return;
      }

      // On success, update the state to show the success message
      setResetSuccess(true);
    } catch (err) {
      console.error(err);
      alert("An error occurred.");
    } finally {
      // Ensure loading is always set to false after the operation
      setLoading(false);
    }
  };

  // 1. Show a loading message while the token is being validated.
  if (tokenValid === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-center text-gray-600 dark:text-gray-300">
          Validating token...
        </p>
      </div>
    );
  }

  // 2. If the token is invalid or expired, show an error message.
  if (tokenValid === false) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="border py-20 border-gray-200 dark:border-gray-800 rounded-lg max-w-md w-full p-8 space-y-5 text-center">
          <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            <span className="font-extrabold">HornEval</span> <br /> Invalid Link
          </h1>
          <p className="text-gray-700 dark:text-gray-400 mb-6">
            This password reset link is invalid or has expired. Please request a
            new one.
          </p>
          <Button
            text="Return to Singin Page"
            onClick={() => router.push("/auth")}
            variant="danger"
          />
        </div>
      </div>
    );
  }

  // 3. If the token is valid, show the form or the success message.
  return (
    <div className="h-full flex items-center justify-center">
      <div className="border py-20 border-gray-200 dark:border-gray-800 rounded-lg max-w-md w-full p-8 space-y-5">
        {resetSuccess ? (
          // Show this view after a successful password reset
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
              Success!
            </h1>
            <p className="text-gray-700 dark:text-gray-400 mb-6">
              Your password has been reset successfully.
            </p>
            <Button
              text="Sign In Now"
              onClick={() => router.push("/auth")}
              variant="success" // Assuming you have a success variant for your button
            />
          </div>
        ) : (
          // Show the form initially
          <form onSubmit={handleSubmit} className="w-full space-y-5">
            <h1 className="text-2xl font-semibold mb-10 text-gray-900 dark:text-white text-center">
              <span className="font-extrabold">HornEval</span> <br /> Reset
              Password
            </h1>

            <div>
              <label className="text-gray-900 dark:text-gray-200">
                New Password
              </label>
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your new password"
              />
            </div>

            <div>
              <label className="text-gray-900 dark:text-gray-200">
                Confirm New Password
              </label>
              <TextInput
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
              />
            </div>

            <Button
              type="submit"
              text={loading ? "Resetting..." : "Reset Password"}
              loading={loading}
              variant="primary"
            />

            <div className="flex justify-end">
              <Link href="/auth" className="text-blue-500 hover:text-blue-400">
                Return to singin page!
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
