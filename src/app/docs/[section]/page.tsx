import { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOC_PAGES, getDocPageData } from "@/lib/docs";
import DocSectionPage from "../DocSectionPage";

type Props = { params: Promise<{ section: string }> };

export async function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ section: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  const data = getDocPageData(section);
  return {
    title: data ? `${data.title} | Documentation | HornEval` : "Documentation | HornEval",
    description: data?.description ?? "HornEval documentation.",
  };
}

export default async function DocSectionRoute({ params }: Props) {
  const { section } = await params;
  const data = getDocPageData(section);
  if (!data) notFound();
  return <DocSectionPage slug={section} data={data} />;
}
