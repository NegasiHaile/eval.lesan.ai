export type DocSectionItem = {
  title: string;
  description?: string;
};

export type DocSection = {
  id: string;
  title: string;
  description?: string;
  /** Optional list items (e.g. for Evaluation types) */
  items?: DocSectionItem[];
  /** Optional sub-sections with subTitle and subDescription */
  subs?: { subTitle: string; subDescription?: string }[];
};

export const DOCS_PAGE_TITLE = "Documentation";
export const DOCS_PAGE_DESCRIPTION =
  "A short guide to HornEval and how to use it.";

export const DOCS_SECTIONS: DocSection[] = [
  {
    id: "introduction",
    title: "Introduction",
    description:
      "HornEval is a lightweight platform for evaluating language technologies: machine translation (MT), automatic speech recognition (ASR), and text-to-speech (TTS). It helps researchers and practitioners run human evaluations, manage datasets, and compare systems on a leaderboard.",
  },
  {
    id: "what-is-horneval",
    title: "What is HornEval?",
    description:
      "HornEval focuses on African languages and low-resource settings. You can run real-time or batch evaluations, upload and manage evaluation datasets, and view ranked results on a public leaderboard. The app uses Better Auth for sign-in (Google, GitHub, Hugging Face) and protects certain routes so only signed-in users can access datasets and profile pages.",
  },
  {
    id: "evaluation-types",
    title: "Evaluation types",
    items: [
      {
        title: "MT (Machine Translation)",
        description:
          "Compare translation outputs, rate quality, and rank systems. Supports real-time and batch evaluation.",
      },
      {
        title: "ASR (Automatic Speech Recognition)",
        description:
          "Evaluate transcriptions with optional reference. Batch upload and human rating.",
      },
      {
        title: "TTS",
        description: "Placeholder for future text-to-speech evaluation.",
      },
    ],
  },
  {
    id: "getting-started",
    title: "Getting started",
    description:
      "From the home page you can start an MT evaluation (add batches, run tasks). The leaderboard is public; datasets and profile require sign-in. Use the navbar to switch between MT, ASR, Leaderboard, and Datasets. Sign in with Google, GitHub, or Hugging Face when prompted for protected actions.",
  },
  {
    id: "authentication",
    title: "Authentication",
    description:
      "HornEval uses Better Auth with OAuth only (no email/password). You can sign in with Google, GitHub, or Hugging Face. Sessions are stored in MongoDB. Routes like /profile, /users, and /datasets are protected by the Next.js proxy; unauthenticated users are redirected to the home page.",
  },
  {
    id: "datasets",
    title: "Datasets",
    description:
      "The Datasets page (for signed-in users) lets you manage MT and ASR evaluation batches. You can upload JSON batches, refresh the list, and open batch details. Each batch has tasks and completion state. Only users with the right role can upload; others may need to ask an admin.",
  },
  {
    id: "leaderboard",
    title: "Leaderboard",
    description:
      "The Leaderboard page is public. It shows ranked systems (e.g. MT or ASR models) based on human evaluation scores. You can filter, pin models for comparison, and see metrics. Data comes from completed evaluation batches.",
  },
  {
    id: "roles",
    title: "Roles & permissions",
    description:
      "Users have a role: user, admin, or root. Only root can open the Users page to manage accounts and roles. Admins can manage datasets and permissions as configured in the app.",
  },
];

/** For sidebar nav: id + label (section title) */
export const DOCS_SIDEBAR_LINKS = DOCS_SECTIONS.map((s) => ({
  id: s.id,
  href: `/docs#${s.id}`,
  label: s.title,
}));
