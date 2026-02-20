import { redirect } from "next/navigation";

export const metadata = {
  title: "Documentation | HornEval",
  description:
    "HornEval documentation: introduction, terminologies, task preparation, evaluation, and leaderboard.",
};

export default function DocsPage() {
  redirect("/docs/introduction");
}
