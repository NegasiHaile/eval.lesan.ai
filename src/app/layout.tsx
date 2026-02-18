import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppChrome from "@/components/AppChrome";
import { UserProvider } from "@/context/UserContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
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
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
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
        url: "/logo.svg",
        width: 512,
        height: 512,
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
        url: "/logo.svg",
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
        <ThemeProvider>
          <UserProvider>
            <PreferencesProvider>
              <AppChrome>{children}</AppChrome>
            </PreferencesProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
