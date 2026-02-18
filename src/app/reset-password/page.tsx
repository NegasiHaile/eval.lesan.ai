"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-neutral-600 dark:text-neutral-400">Redirecting...</p>
    </div>
  );
}
