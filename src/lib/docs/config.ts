/** Ordered list of doc pages for left sidebar and prev/next navigation */
export const DOC_PAGES = [
  { slug: "introduction", title: "Introduction" },
  { slug: "terminologies", title: "Terminologies" },
  { slug: "task-preparation", title: "Task preparation" },
  { slug: "evaluation", title: "Evaluation" },
  { slug: "leaderboard", title: "Leaderboard" },
] as const;

export type DocPageSlug = (typeof DOC_PAGES)[number]["slug"];

export function getDocPageBySlug(slug: string): (typeof DOC_PAGES)[number] | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}

export function getPrevNextSlug(
  slug: string
): { prev: string | null; next: string | null } {
  const i = DOC_PAGES.findIndex((p) => p.slug === slug);
  if (i < 0)
    return { prev: null, next: null };
  return {
    prev: i > 0 ? DOC_PAGES[i - 1].slug : null,
    next: i < DOC_PAGES.length - 1 && i >= 0 ? DOC_PAGES[i + 1].slug : null,
  };
}
