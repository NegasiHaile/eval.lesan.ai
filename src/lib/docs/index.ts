import { DOC_PAGES, getDocPageBySlug, getPrevNextSlug } from "./config";
import introductionData from "./introduction.json";
import terminologiesData from "./terminologies.json";
import taskPreparationData from "./task-preparation.json";
import evaluationData from "./evaluation.json";
import leaderboardData from "./leaderboard.json";

export type DocBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; code: string; language?: string };

export type DocSubsection = {
  id: string;
  title: string;
  blocks: DocBlock[];
};

export type DocPageData = {
  title: string;
  description?: string;
  subsections: DocSubsection[];
};

const DATA_MAP: Record<string, DocPageData> = {
  introduction: introductionData as DocPageData,
  terminologies: terminologiesData as DocPageData,
  "task-preparation": taskPreparationData as DocPageData,
  evaluation: evaluationData as DocPageData,
  leaderboard: leaderboardData as DocPageData,
};

export function getDocPageData(slug: string): DocPageData | null {
  return DATA_MAP[slug] ?? null;
}

export { DOC_PAGES, getDocPageBySlug, getPrevNextSlug };
