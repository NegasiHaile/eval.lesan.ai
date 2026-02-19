"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DOCS_SIDEBAR_LINKS } from "@/constants/docsContent";
import { ReactNode } from "react";

export default function DocsShell({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const ids = DOCS_SIDEBAR_LINKS.map((l) => l.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.id;
          if (ids.includes(id)) setActiveId(id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    elements.forEach((el) => observer.observe(el));
    return () => elements.forEach((el) => observer.unobserve(el));
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground md:flex-row">
      {/* Mobile: compact top nav */}
      <div className="border-b border-border bg-muted/30 px-4 py-3 md:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="font-semibold text-foreground hover:text-primary"
          >
            ← {process.env.NEXT_PUBLIC_APP_NAME}
          </Link>
          <span className="text-muted-foreground">·</span>
          {DOCS_SIDEBAR_LINKS.slice(0, 4).map(({ href, label, id }) => (
            <Link
              key={id}
              href={href}
              className={`text-sm ${activeId === id ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      {/* Desktop: fixed left sidebar with active state */}
      <aside
        className="fixed left-0 top-0 z-10 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-muted/30 p-4 md:flex"
        aria-label="Documentation navigation"
      >
        <Link
          href="/"
          className="mb-4 font-semibold text-foreground hover:text-primary"
        >
          ← HornEval
        </Link>
        <nav className="flex flex-col gap-1">
          {DOCS_SIDEBAR_LINKS.map(({ href, label, id }) => (
            <Link
              key={id}
              href={href}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                activeId === id
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      {/* Content area: offset by sidebar width on desktop */}
      <div className="min-w-0 flex-1 md:pl-56">
        {children}
      </div>
    </div>
  );
}
