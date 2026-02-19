"use client";

import { usePathname } from "next/navigation";
import NavBar from "@/components/navbar";
import Footer from "@/components/footer";
import { ReactNode } from "react";

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDocs = pathname?.startsWith("/docs");

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
