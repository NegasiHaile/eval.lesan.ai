"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/navbar";
import Footer from "@/components/footer";
import { ReactNode } from "react";
import { useUser } from "@/context/UserContext";

const PROTECTED_PATH_PREFIXES = ["/profile", "/users", "/datasets"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isInitialSessionPending } = useUser();
  const isDocs = pathname?.startsWith("/docs");
  const onProtectedPath = isProtectedPath(pathname ?? "");

  useEffect(() => {
    if (!isInitialSessionPending && onProtectedPath && !user?.username) {
      router.replace("/");
    }
  }, [isInitialSessionPending, onProtectedPath, user?.username, router]);

  // Wait for Better Auth bootstrap before rendering public/private UI.
  if (isInitialSessionPending) {
    return <div className="fixed inset-0 bg-white dark:bg-neutral-900" aria-hidden="true" />;
  }

  if (onProtectedPath && !user?.username) {
    return <div className="fixed inset-0 bg-white dark:bg-neutral-900" aria-hidden="true" />;
  }

  if (isDocs) {
    return <>{children}</>;
  }

  return (
    <>
      <NavBar />
      <main className="flex-grow pt-18 md:pt-12 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300">
        {children}
      </main>
      <Footer />
    </>
  );
}
