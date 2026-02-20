"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DocPageData, DocBlock } from "@/lib/docs";
import { DOC_PAGES, getPrevNextSlug } from "@/lib/docs";

const CODE_WORDS = [
  "dataset_name", "dataset_domain", "batch_name", "source_language", "target_language",
  "language", "tasks", "models", "rate", "rank", "input", "output", "model",
  "rating_guideline", "task_models_shuffles", "domains", "reference", "domain",
];

function codeRegex() {
  return new RegExp(`\\b(${CODE_WORDS.join("|")})\\b`, "gi");
}

function TextWithCode({ text, as: Wrapper = "p", className = "" }: { text: string; as?: "p" | "span"; className?: string }) {
  const regex = codeRegex();
  const parts = text.split(regex).filter(Boolean);
  const content = (
    <>
      {parts.map((part, i) => {
        const normalized = part.toLowerCase();
        if (CODE_WORDS.includes(normalized)) {
          return (
            <code key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
              {part}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
  const defaultClass = Wrapper === "p" ? "mb-4 leading-relaxed text-foreground" : "text-foreground";
  return <Wrapper className={className || defaultClass}>{content}</Wrapper>;
}

function ContentBlocks({ blocks }: { blocks: DocBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.type === "p") {
          return <TextWithCode key={i} text={block.text} as="p" />;
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="list-inside list-disc space-y-1.5 text-foreground">
              {block.items.map((item, j) => (
                <li key={j}>
                  <TextWithCode text={item} as="span" />
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={i} className="list-inside list-decimal space-y-1.5 text-foreground">
              {block.items.map((item, j) => (
                <li key={j}>
                  <TextWithCode text={item} as="span" />
                </li>
              ))}
            </ol>
          );
        }
        if (block.type === "code") {
          return (
            <div key={i} className="my-3 w-full min-w-0 overflow-x-auto rounded-lg border border-border bg-muted/50">
              <pre className="min-w-0 max-w-full overflow-x-auto p-3 text-[11px] leading-relaxed sm:p-4 sm:text-xs">
                <code className="whitespace-pre text-foreground">{block.code}</code>
              </pre>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

type DocSectionPageProps = { slug: string; data: DocPageData };

export default function DocSectionPage({ slug, data }: DocSectionPageProps) {
  const { prev, next } = getPrevNextSlug(slug);
  const prevPage = prev ? DOC_PAGES.find((p) => p.slug === prev) : null;
  const nextPage = next ? DOC_PAGES.find((p) => p.slug === next) : null;
  const subsectionIds = data.subsections.map((s) => s.id);
  const [activeId, setActiveId] = useState<string | null>(subsectionIds[0] ?? null);

  useEffect(() => {
    if (subsectionIds.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries
          .filter((e) => e.isIntersecting && subsectionIds.includes(e.target.id))
          .map((e) => ({ id: e.target.id, top: e.boundingClientRect.top }))
          .sort((a, b) => a.top - b.top);
        if (intersecting.length > 0) setActiveId(intersecting[0].id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    const elements = subsectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    elements.forEach((el) => observer.observe(el));
    return () => elements.forEach((el) => observer.unobserve(el));
  }, [slug, subsectionIds.join(",")]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full max-w-6xl mx-auto">
      <article className="min-w-0 flex-1 px-6 py-10 lg:pr-8">
        <header className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">
            {data.title}
          </h1>
          {data.description && (
            <p className="text-muted-foreground">{data.description}</p>
          )}
        </header>

        <div className="space-y-10">
          {data.subsections.map((sub) => (
            <section
              key={sub.id}
              id={sub.id}
              className="scroll-mt-28 border-b border-border/50 pb-8 last:border-0 last:pb-0"
            >
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                {sub.title}
              </h2>
              <ContentBlocks blocks={sub.blocks} />
            </section>
          ))}
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
          {prevPage ? (
            <Link
              href={`/docs/${prevPage.slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <span aria-hidden>←</span>
              <span>{prevPage.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {nextPage ? (
            <Link
              href={`/docs/${nextPage.slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <span>{nextPage.title}</span>
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <span />
          )}
        </footer>
      </article>

      <aside
        className="sticky top-24 hidden h-[calc(100vh-6rem)] w-52 shrink-0 overflow-y-auto py-10 pl-6 xl:block"
        aria-label="On this page"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          On this page
        </p>
        <nav className="flex flex-col gap-0.5">
          {data.subsections.map((sub) => {
            const isActive = activeId === sub.id;
            return (
              <a
                key={sub.id}
                href={`#${sub.id}`}
                className={`block border-l-2 py-1.5 pl-3 text-sm transition-colors ${
                  isActive
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                {sub.title}
              </a>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
