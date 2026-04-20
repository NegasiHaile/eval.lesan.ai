"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info, Sparkles } from "lucide-react";

type PropTypes = {
  isRealtime: boolean;
};

export default function MTEvaluationGuide({ isRealtime }: PropTypes) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="mt-16 md:mt-20">
      <div className="rounded-2xl border border-neutral-200/70 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/70 backdrop-blur shadow-sm overflow-hidden">
        <div className="px-5 md:px-6 py-4 md:py-5 border-b border-neutral-200/70 dark:border-neutral-800 bg-gradient-to-r from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-900">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                <Sparkles className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <h2 className="text-base md:text-lg font-semibold">
                  Evaluation guide
                </h2>
              </div>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {isRealtime ? "Realtime" : "Batch based"} MT evaluation — quick
                steps and scoring rubric.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
              <Info className="size-4" />
              <span>Read this before submitting</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-xs text-neutral-700 dark:text-neutral-300">
              Rate each output (1–5)
            </span>
            <span className="inline-flex items-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-xs text-neutral-700 dark:text-neutral-300">
              Rank best → worst
            </span>
            <span className="inline-flex items-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-xs text-neutral-700 dark:text-neutral-300">
              Domain optional
            </span>
            <span className="inline-flex items-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-xs text-neutral-700 dark:text-neutral-300">
              Reference optional
            </span>
          </div>
        </div>

      {isRealtime ? (
        <div className="relative px-5 md:px-6 py-4 md:py-5">
          <div
            className={`transition-all duration-300 ease-in-out ${
              expanded ? "max-h-[2000px]" : "max-h-[160px]"
            } overflow-hidden`}
          >
            <ol className="space-y-3 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                Select languages.
              </span>{" "}
              Choose a{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                source language
              </strong>{" "}
              and a{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                target language
              </strong>
              .
            </li>
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                Paste input.
              </span>{" "}
              Paste the sentence into the left input box.
            </li>
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                Generate outputs.
              </span>{" "}
              Click{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                Translate
              </span>{" "}
              to get multiple model outputs.
            </li>
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                Rate each output.
              </span>{" "}
              Use 1–5 stars:
              <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <li>⭐️ – Bad: Wrong or unusable translation.</li>
                <li>⭐️⭐️ – Poor: Significant problems.</li>
                <li>⭐️⭐️⭐️ – Fair: Understandable, some errors.</li>
                <li>⭐️⭐️⭐️⭐️ – Good: Minor issues, still clear.</li>
                <li>⭐️⭐️⭐️⭐️⭐️ – Perfect: Accurate, fluent, no errors.</li>
              </ul>
            </li>
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                Rank outputs.
              </span>{" "}
              Use{" "}
              <span className="font-semibold text-green-600 dark:text-green-400">
                ↑ Up
              </span>{" "}
              /{" "}
              <span className="font-semibold text-red-600 dark:text-red-400">
                ↓ Down
              </span>{" "}
              to order best → worst.
            </li>
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                (Optional) Add a domain.
              </span>{" "}
              Select a domain like <em>Health</em>, <em>News</em>,{" "}
              <em>Agriculture</em>, etc.
            </li>
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                (Optional) Add a reference.
              </span>{" "}
              If all outputs are poor (e.g. &lt; 3 stars), add a better
              translation in{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                + Reference
              </strong>
              .
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-400">
                Tip: You can copy one of the outputs and improve it instead of
                starting from scratch.
              </p>
            </li>
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                Submit.
              </span>{" "}
              Click{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                Submit
              </strong>{" "}
              to save; model names are revealed after submission.
            </li>
          </ol>
          </div>

          {!expanded && (
            <div className="pointer-events-none absolute bottom-16 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-neutral-900 to-transparent" />
          )}

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors"
            >
              {expanded ? (
                <>
                  <span>Show less</span>
                  <ChevronUp className="size-4" />
                </>
              ) : (
                <>
                  <span>Read more</span>
                  <ChevronDown className="size-4" />
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative px-5 md:px-6 py-4 md:py-5">
          <div
            className={`transition-all duration-300 ease-in-out ${
              expanded ? "max-h-[2000px]" : "max-h-[160px]"
            } overflow-hidden`}
          >
            <ol className="space-y-3 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                Select a dataset.
              </span>{" "}
              Choose the data from the{" "}
              <strong className="text-blue-600 dark:text-blue-400">Data</strong>{" "}
              dropdown.
            </li>
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                Rate each output.
              </span>{" "}
              <span className="ml-2 inline-flex items-center rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-2 py-0.5 text-xs font-medium">
                required
              </span>
              <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <li>⭐️ – Bad: Wrong or unusable translation.</li>
                <li>⭐️⭐️ – Poor: Significant problems.</li>
                <li>⭐️⭐️⭐️ – Fair: Understandable, some errors.</li>
                <li>⭐️⭐️⭐️⭐️ – Good: Minor issues, still clear.</li>
                <li>⭐️⭐️⭐️⭐️⭐️ – Perfect: Accurate, fluent, no errors.</li>
              </ul>
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-400">
                Tip: Hover on a star to see the score meaning.
              </p>
            </li>
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                Rank outputs.
              </span>{" "}
              Use{" "}
              <span className="font-semibold text-green-600 dark:text-green-400">
                ↑ Up
              </span>{" "}
              /{" "}
              <span className="font-semibold text-red-600 dark:text-red-400">
                ↓ Down
              </span>{" "}
              to order best → worst.{" "}
              <span className="ml-2 inline-flex items-center rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-2 py-0.5 text-xs font-medium">
                required
              </span>
            </li>
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                (Optional) Add a domain.
              </span>{" "}
              Select a domain like <em>Health</em>, <em>News</em>,{" "}
              <em>Agriculture</em>, etc.
            </li>
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                (Optional) Add a reference.
              </span>{" "}
              If all outputs are poor (e.g. &lt; 3 stars), add a better
              translation in{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                + Reference
              </strong>
              .
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-400">
                Tip: You can copy one of the outputs and improve it instead of
                starting from scratch.
              </p>
            </li>
            <li>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                Submit.
              </span>{" "}
              Click{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                Submit
              </strong>{" "}
              to save; model names are revealed after submission.
            </li>
          </ol>
          </div>

          {!expanded && (
            <div className="pointer-events-none absolute bottom-16 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-neutral-900 to-transparent" />
          )}

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors"
            >
              {expanded ? (
                <>
                  <span>Show less</span>
                  <ChevronUp className="size-4" />
                </>
              ) : (
                <>
                  <span>Read more</span>
                  <ChevronDown className="size-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      </div>
    </section>
  );
}
