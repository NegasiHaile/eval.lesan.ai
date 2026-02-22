"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_PAGES } from "@/lib/docs";
import { ReactNode } from "react";

export default function DocsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentSlug = pathname?.startsWith("/docs/") ? pathname.replace("/docs/", "").split("/")[0] : null;
  const isDocsRoot = pathname === "/docs";

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground md:flex-row">
      {/* Mobile: compact top nav */}
      <div className="border-b border-border bg-muted/30 px-4 py-3 md:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="font-semibold text-foreground hover:text-primary">
            ← {process.env.NEXT_PUBLIC_APP_NAME}
          </Link>
          <span className="text-muted-foreground">·</span>
          {DOC_PAGES.map(({ slug, title }) => (
            <Link
              key={slug}
              href={`/docs/${slug}`}
              className={`text-sm ${currentSlug === slug ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {title}
            </Link>
          ))}
        </div>
      </div>

      {/* Desktop: fixed left sidebar – main titles only */}
      <aside
        className="fixed left-0 top-0 z-10 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-muted/30 p-4 md:flex"
        aria-label="Documentation navigation"
      >
        <Link href="/" className="mb-4 font-semibold text-foreground hover:text-primary">
          ← {process.env.NEXT_PUBLIC_APP_NAME}
        </Link>
        <nav className="flex flex-col gap-1">
          {DOC_PAGES.map(({ slug, title }) => {
            const isActive = currentSlug === slug || (isDocsRoot && slug === "introduction");
            return (
              <Link
                key={slug}
                href={`/docs/${slug}`}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
                }`}
              >
                {title}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content area: offset by sidebar width on desktop */}
      <div className="min-w-0 flex-1 md:pl-56">
        {children}
      </div>
    </div>
  );
}
