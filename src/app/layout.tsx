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
      {/* OG/Twitter meta tags are handled by the metadata export above */}
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
