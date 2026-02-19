"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type PropTypes = {
  isRealtime: boolean;
};

export default function MTEvaluationGuide({ isRealtime }: PropTypes) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative mt-28 bg-gradient-to-b from-neutral-50 to-neutral-200 dark:from-neutral-900 dark:to-neutral-800/60 text-neutral-900 dark:text-neutral-200 px-6 py-4 rounded-b-md leading-relaxed transition-all duration-300 overflow-hidden">
      <h2 className="text-lg font-semibold mb-3">
        <span className=" opacity-70">
          {isRealtime ? "Realtime" : "Batch Based"} evaluation:
        </span>{" "}
        How It Works
      </h2>

      {isRealtime ? (
        <div
          className={`transition-all duration-400 ease-in-out ${
            expanded ? "max-h-[2000px]" : "max-h-[120px]"
          } overflow-hidden`}
        >
          <ol className="list-disc list-inside space-y-2">
            <li>
              Select{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                source-language
              </strong>{" "}
              that you want to translate from and{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                target-language
              </strong>{" "}
              you want translate the text to.
            </li>
            <li>
              Copy the{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                source-language
              </strong>{" "}
              sentence you want to evaluate and paste it into the text area on
              the left.
            </li>
            <li>
              Click the{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                Translate
              </span>{" "}
              button to generate translations. Then you will see translation
              outputs from different models on the right.
            </li>
            <li>
              Use the star ratings (1 to 5) to score each output:
              <ul className="list-decimal list-inside ml-5 mt-2 space-y-1">
                <li>⭐️ – Bad: Wrong or unusable translation.</li>
                <li>⭐️⭐️ – Poor: Significant problems.</li>
                <li>⭐️⭐️⭐️ – Fair: Understandable, some errors.</li>
                <li>⭐️⭐️⭐️⭐️ – Good: Minor issues, still clear.</li>
                <li>⭐️⭐️⭐️⭐️⭐️ – Perfect: Accurate, fluent, no errors.</li>
              </ul>
            </li>
            <li>
              Use the <span className="text-green-500">↑ Up</span> and{" "}
              <span className="text-red-500">↓ Down</span> arrows to reorder
              outputs based on quality from best to worst.
            </li>
            <li>
              Select the content domain like <em>Health</em>, <em>News</em>,{" "}
              <em>Agriculture</em>, etc.{" "}
              <span className="opacity-60 ml-3 font-mono bg-neutral-300 dark:bg-neutral-700 px-2 rounded-full">
                optional
              </span>
            </li>
            <li>
              If all outputs are incorrect (rated less than 3 stars), add a
              better translation in the{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                + Reference
              </strong>{" "}
              box.{" "}
              <span className="opacity-60 ml-3 font-mono bg-neutral-300 dark:bg-neutral-700 px-2 rounded-full">
                optional
              </span>
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-400">
                Tip: You can copy one of the outputs and improve it instead of
                starting from scratch.
              </p>
            </li>
            <li>
              Click the{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                Submit
              </strong>{" "}
              button. Then, the model’s exact name will be revealed.
            </li>
          </ol>
        </div>
      ) : (
        <div
          className={`transition-all duration-400 ease-in-out ${
            expanded ? "max-h-[2000px]" : "max-h-[120px]"
          } overflow-hidden`}
        >
          <ol className="list-disc list-inside space-y-2">
            <li>
              Select the data that you want to evaluate on the{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                Data |
              </strong>{" "}
              dropdown on the top right.
            </li>
            <li>
              Use the star ratings (1 to 5) to score each output:{" "}
              <span className="opacity-60 ml-3 text-center font-mono bg-neutral-300 dark:bg-neutral-700 px-2 rounded-full text-red-700 dark:text-red-400">
                *required
              </span>
              <ul className="list-decimal list-inside ml-5 mt-2 space-y-1">
                <li>⭐️ – Bad: Wrong or unusable translation.</li>
                <li>⭐️⭐️ – Poor: Significant problems.</li>
                <li>⭐️⭐️⭐️ – Fair: Understandable, some errors.</li>
                <li>⭐️⭐️⭐️⭐️ – Good: Minor issues, still clear.</li>
                <li>⭐️⭐️⭐️⭐️⭐️ – Perfect: Accurate, fluent, no errors.</li>
              </ul>
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-400">
                Tip: Hover on the star to get more information about the start
                values.
              </p>
            </li>
            <li>
              Use the <span className="text-green-500">↑ Up</span> and{" "}
              <span className="text-red-500">↓ Down</span> arrows to reorder
              outputs based on quality from best to worst.{" "}
              <span className="opacity-60 ml-3 text-center font-mono bg-neutral-300 dark:bg-neutral-700 px-2 rounded-full text-red-700 dark:text-red-400">
                *required
              </span>
            </li>
            <li>
              Select the content domain like <em>Health</em>, <em>News</em>,{" "}
              <em>Agriculture</em>, etc.
              <span className="opacity-60 ml-3 font-mono bg-neutral-300 dark:bg-neutral-700 px-2 rounded-full">
                optional
              </span>
            </li>
            <li>
              If all outputs are incorrect (rated less than 3 stars), add a
              better translation in the{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                + Reference
              </strong>{" "}
              box.{" "}
              <span className="opacity-60 ml-3 font-mono bg-neutral-300 dark:bg-neutral-700 px-2 rounded-full">
                optional
              </span>
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-400">
                Tip: You can copy one of the outputs and improve it instead of
                starting from scratch.
              </p>
            </li>
            <li>
              Click the{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                Submit
              </strong>{" "}
              button. Then, the model’s exact name will be revealed.
            </li>
          </ol>
        </div>
      )}

      {/* Gradient overlay for collapsed state */}
      {!expanded && (
        <div className="absolute bottom-10 left-0 w-full h-16 bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}

      {/* Toggle Button */}
      <div className="mt-4 flex justify-center items-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-blue-600 dark:text-blue-400 font-medium flex items-center space-x-1 hover:underline focus:outline-none cursor-pointer"
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
  );
}
