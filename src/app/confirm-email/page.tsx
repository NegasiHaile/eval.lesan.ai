"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/utils/Button";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [success, setSuccess] = useState(false);

  const activateAccount = async (email: string) => {
    console.log("Email:", email);
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: email, active: true }),
    });

    return res.ok;
  };

  const verifyToken = async () => {
    try {
      const res = await fetch(`/api/auth/verify-token?token=${token}`);
      if (!res.ok) throw new Error("Token verification failed");

      const data = await res.json();

      if (data.valid && data.email) {
        setTokenValid(true);

        const activated = await activateAccount(data.email);
        setSuccess(activated);
      } else {
        setTokenValid(false);
        setSuccess(false);
      }
    } catch {
      setTokenValid(false);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setLoading(false);
      return;
    }

    verifyToken();
  }, [token]);

  const renderContent = () => {
    if (tokenValid === false) {
      return (
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            <span className="font-extrabold">HornEval</span> <br />
            Invalid Link
          </h1>
          <p className="text-gray-700 dark:text-gray-400 mb-6">
            This link is invalid or has expired. Please use a valid one.
          </p>
          <Button
            text="Return to Main Page"
            onClick={() => router.push("/")}
            variant="danger"
          />
        </div>
      );
    }

    if (success) {
      return (
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            Success!
          </h1>
          <p className="text-gray-700 dark:text-gray-400 mb-6">
            Your account has been activated successfully. Please sign in now.
          </p>
          <Button
            text="Sign In Now"
            onClick={() => router.push("/")}
            variant="success"
          />
        </div>
      );
    } else
      return (
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            Oops! Something went wrong.
          </h1>
          <Button
            text="Try Again"
            onClick={() => window.location.reload()}
            variant="danger"
          />
        </div>
      );
  };

  return (
    <div className="h-full flex items-center justify-center">
      <div className="border py-20 border-gray-200 dark:border-gray-800 rounded-lg max-w-md w-full p-8 space-y-5">
        {loading ? (
          <p className="text-center text-gray-700 dark:text-gray-300">
            Loading...
          </p>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  );
}
