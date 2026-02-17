// components/PrivateRoute.tsx
"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@/context/UserContext";

export default function PrivateRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isPending } = useUser();

  useEffect(() => {
    if (isPending) return;
    if (!user) router.replace("/");
  }, [user, isPending, router]);

  if (isPending || !user) return null;
  return <>{children}</>;
}
