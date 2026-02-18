import {
  DOCS_PAGE_DESCRIPTION,
  DOCS_PAGE_TITLE,
  DOCS_SECTIONS,
} from "@/constants/docsContent";

export const metadata = {
  title: "Documentation | HornEval",
  description:
    "HornEval documentation: language technologies evaluation, MT, ASR, datasets, and leaderboard.",
};

const CODE_WORDS = ["user", "admin", "root", "profile", "users", "datasets"];

/** Wraps route paths and role names in <code> for display */
function DescriptionWithCode({ text }: { text: string }) {
  const regex = new RegExp(`(/?(${CODE_WORDS.join("|")})/?)`, "gi");
  const parts = text.split(regex).filter(Boolean);
  return (
    <p className="mb-4 leading-relaxed text-foreground">
      {parts.map((part, i) => {
        const normalized = part.replace(/^\/|\/$/g, "").toLowerCase();
        if (CODE_WORDS.includes(normalized)) {
          return (
            <code
              key={i}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
            >
              {part}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export default function DocsPage() {
  return (
    <article className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">
        {DOCS_PAGE_TITLE}
      </h1>
      <p className="mb-12 text-muted-foreground">
        {DOCS_PAGE_DESCRIPTION}
      </p>

      {DOCS_SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="scroll-mt-24 pt-10 first:pt-0"
        >
          <h2 className="mb-3 text-xl font-semibold text-foreground">
            {section.title}
          </h2>

          {section.description && (
            <DescriptionWithCode text={section.description} />
          )}

          {section.items && (
            <ul className="list-inside list-disc space-y-2 text-foreground">
              {section.items.map((item, i) => (
                <li key={i}>
                  <strong>{item.title}</strong>
                  {item.description != null && item.description !== ""
                    ? ` — ${item.description}`
                    : null}
                </li>
              ))}
            </ul>
          )}

          {section.subs?.map((sub, i) => (
            <div key={i} className="mt-3">
              <h3 className="mb-1 text-lg font-medium text-foreground">
                {sub.subTitle}
              </h3>
              {sub.subDescription && (
                <p className="mb-2 leading-relaxed text-foreground">
                  {sub.subDescription}
                </p>
              )}
            </div>
          ))}
        </section>
      ))}

      <footer className="mt-16 border-t border-border pt-8 text-sm text-muted-foreground">
        <p>
          For setup and environment variables, see the project README and{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
            .env.example
          </code>
          .
        </p>
      </footer>
    </article>
  );
}
