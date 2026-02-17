import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/navbar";
import Footer from "@/components/footer";
import { UserProvider } from "@/context/UserContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { ReactNode } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Language Models Leaderboard | HornEval",
  description:
    "A language models evaluation dataset benchmarking and leaderboard platform for African languages Machine Translation (MT), Automatic Speech Recognition (ASR), and Text-to-Speech (TTS). Includes tools for crowdsourced data collection and performance analysis.",
  openGraph: {
    title: "Language Models Leaderboard | HornEval",
    description:
      "A language models evaluation dataset benchmarking and leaderboard platform for African languages Machine Translation (MT), Automatic Speech Recognition (ASR), and Text-to-Speech (TTS). Includes tools for crowdsourced data collection and performance analysis.",
    url: "https://eval.lesan.ai/",
    siteName: "HornEval",
    images: [
      {
        url: "/public/file.svg",
        width: 1200,
        height: 630,
        alt: "HornEval Language Models Leaderboard",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@horneval",
    title: "Language Models Leaderboard | HornEval",
    description:
      "A language models evaluation dataset benchmarking and leaderboard platform for African languages Machine Translation (MT), Automatic Speech Recognition (ASR), and Text-to-Speech (TTS). Includes tools for crowdsourced data collection and performance analysis.",
    images: [
      {
        url: "/public/file.svg",
        alt: "HornEval Language Models Leaderboard",
      },
    ],
  },
  alternates: {
    canonical: "https://eval.lesan.ai/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://eval.lesan.ai/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="HornEval" />
        <meta
          property="og:title"
          content="Language Technologies Evaluation & Leaderboard | HornEval"
        />
        <meta
          property="og:description"
          content="An evaluation, crowdsourcing, and leaderboard tool for language technologies like Machine Translation (MT), Automatic Speech Recognition (ASR), Text-to-Speech (TTS), and Large Language Models (LLMs). This tool helps you analyze which language technology is fit for your purpose"
        />
        <meta property="og:image" content="/public/file.svg" />
        <meta property="og:url" content="https://eval.lesan.ai/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@horneval" />
        <meta
          name="twitter:title"
          content="Language Models Leaderboard | HornEval"
        />
        <meta
          name="twitter:description"
          content="A language models evaluation dataset benchmarking and leaderboard platform for African languages Machine Translation (MT), Automatic Speech Recognition (ASR), and Text-to-Speech (TTS). Includes tools for crowdsourced data collection and performance analysis."
        />
        <meta name="twitter:image" content="/public/file.svg" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex flex-col min-h-screen antialiased`}
      >
        <UserProvider>
          <PreferencesProvider>
            <NavBar />
            <main className="flex-grow pt-18 md:pt-12 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">
              {children}
            </main>
            <Footer />
          </PreferencesProvider>
        </UserProvider>
      </body>
    </html>
  );
}
