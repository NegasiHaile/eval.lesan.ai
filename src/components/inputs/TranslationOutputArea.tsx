import { guidelineTypes, EvalOutputTypes } from "@/types/data";
import { TaskEvalErrorTypes } from "@/types/others";
import React from "react";
import Tooltip from "../utils/Tooltip";
import { tausRating, tausRatingTranscription } from "@/constants/others";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Languages,
  Mic,
  Volume2,
} from "lucide-react";
import CopyText from "../utils/CopyText";

type OutputProps = {
  index: number;
  outputTextareaHeight: number | string;
  translation: EvalOutputTypes;
  onClickRankUp: () => void;
  onClickRankDown: () => void;
  onClickRate: (index: number, star: number) => void;
  error: TaskEvalErrorTypes | null;
  isLastItem: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  type?: "mt" | "asr" | "tts" | null;
  rating_guideline?: guidelineTypes[] | undefined;
};

const borderColorsHex = [
  "transparent", // Transparent
  "#d83636", // From oklch(50.5% 0.213 27.518)
  "#ff4500", // Already in hex
  "#ffa500", // From oklch(68.1% 0.162 75.834)
  "oklch(72.3% 0.219 149.579)", // From oklch(72.3% 0.219 149.579)
  "oklch(70.7% 0.194 149.214)", // From oklch(62.7% 0.194 149.214)
];

const TranslationOutputArea = ({
  index,
  outputTextareaHeight,
  translation,
  onClickRankUp,
  onClickRankDown,
  onClickRate,
  error,
  isLastItem,
  isLoading,
  disabled,
  type,
  rating_guideline,
}: OutputProps) => {
  const ratingGuideline =
    rating_guideline && rating_guideline?.length > 0
      ? rating_guideline
      : type === "asr"
        ? tausRatingTranscription
        : tausRating;

  /** For ASR tooltip, show transcription wording even if guideline text says "translation". */
  const tooltipDescription = (desc: string | undefined) =>
    type === "asr" && desc
      ? desc
          .replace(/\btranslation\b/gi, "transcription")
          .replace(/\bthe source\b/gi, "the audio")
          .replace(/\bsource\b/gi, "audio")
      : desc;

  const modelIcon = () => {
    if (type === "asr") {
      return <Mic className="size-5 shrink-0" />;
    }
    if (type === "tts") {
      return <Volume2 className="size-5 shrink-0" />;
    }
    return <Languages className="size-5 shrink-0" />;
  };

  return (
    <div
      id={`translation_${index}`}
      key={`translation_${index}`}
      className={`relative w-full rounded-lg border ${
        error && error.errorTitles?.includes(translation.model)
          ? "border-red-500"
          : "border-transparent"
      } ${disabled ? "select-none" : ""} bg-neutral-200/80 dark:bg-neutral-800/80`}
      onCopy={disabled ? (e) => e.preventDefault() : undefined}
      onCut={disabled ? (e) => e.preventDefault() : undefined}
      onContextMenu={disabled ? (e) => e.preventDefault() : undefined}
    >
      <div
        className={`w-full p-3 h-auto min-h-35 ${outputTextareaHeight} rounded-t-md focus:outline-none transition-all duration-600 ease-in-out`}
      >
        {isLoading ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="24"
            viewBox="0 0 24 24"
          >
            <circle cx="18" cy="12" r="0" fill="currentColor">
              <animate
                attributeName="r"
                begin=".67"
                calcMode="spline"
                dur="1.5s"
                keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8"
                repeatCount="indefinite"
                values="0;4;0;0"
              />
            </circle>
            <circle cx="12" cy="12" r="0" fill="currentColor">
              <animate
                attributeName="r"
                begin=".33"
                calcMode="spline"
                dur="1.5s"
                keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8"
                repeatCount="indefinite"
                values="0;3;0;0"
              />
            </circle>
            <circle cx="6" cy="12" r="0" fill="currentColor">
              <animate
                attributeName="r"
                begin="0"
                calcMode="spline"
                dur="1.5s"
                keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8"
                repeatCount="indefinite"
                values="0;2;0;0"
              />
            </circle>
          </svg>
        ) : (
          <p className="whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
            {translation.output}
          </p>
        )}
      </div>

      <div className="w-full flex justify-between rounded-b-md items-center space-x-1">
        <div className="flex items-center space-x-3">
          <div className="w-fit flex space-x-1 items-center p-1 bg-neutral-200 dark:bg-neutral-800 rounded-bl-md rounded-tr-xl">
            {modelIcon()}
            <p className="font-mono text-sm">
              Model{" "}
              <span className="text-sm md:text-lg font-extrabold">
                {translation.model}
              </span>
            </p>
          </div>
        </div>

        {translation.output && <CopyText textToCopy={translation.output} />}

        {
          <div className="flex items-center space-x-1">
            <div className="flex items-center space-x-2 mx-6">
              {index > 0 && translation.output && (
                <button
                  id="up_arrow"
                  onClick={onClickRankUp}
                  className="cursor-pointer opacity-80 hover:opacity-50 group"
                >
                  {/* Up Arrow SVG */}
                  <ArrowUpFromLine
                    strokeWidth={1.5}
                    className="size-5 md:size-7 transition-transform duration-200 group-hover:-translate-y-1"
                  />
                </button>
              )}
              {!isLastItem && translation.output && (
                <button
                  id="down_arrow"
                  onClick={onClickRankDown}
                  className="cursor-pointer opacity-80 hover:opacity-50 group"
                >
                  {/* Down Arrow SVG */}
                  <ArrowDownToLine
                    strokeWidth={1.5}
                    className="size-5 md:size-7 transition-transform duration-200 group-hover:translate-y-1"
                  />
                </button>
              )}
            </div>

            {ratingGuideline.map((item) => (
              <Tooltip
                key={item?.scale}
                pointerStyle="border-t-neutral-100 dark:border-t-neutral-900"
                tooltipContent={
                  <div className="space-y-3">
                    <p className=" text-lg font-mono text-nowrap px-3 py-1 border-b border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-400">
                      Rate-Value: {item?.value} ({item?.scale})
                    </p>

                    <p className="px-3 pb-3 text-sm font-mono text-neutral-700 dark:text-neutral-400">
                      {tooltipDescription(item?.description)}
                    </p>

                    {/* <div className="space-x-1 space-y-1 flex-wrap">
                      <p className="font-bold">Error Examples:</p>
                      <ul className="pl-5 list-disc">
                        <li>A</li>
                        <li>B</li>
                      </ul>
                    </div> */}
                  </div>
                }
              >
                <button
                  key={item?.scale}
                  className={`flex items-center ${
                    !!translation?.output
                      ? "cursor-pointer hover:opacity-60"
                      : "opacity-40 cursor-auto"
                  }`}
                  onClick={() => onClickRate(index, item?.scale)}
                  disabled={!!!translation?.output}
                  // onMouseEnter={() => RateTranslation(index, star)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill={
                      item?.scale <= translation?.rate
                        ? borderColorsHex[translation?.rate]
                        : "none"
                    }
                    viewBox="0 0 24 24"
                    strokeWidth={1}
                    stroke={
                      item?.scale <= translation?.rate
                        ? borderColorsHex[translation?.rate]
                        : "currentColor"
                    }
                    className={`size-5 md:size-8 transition-all duration-400 ease-in-out ${
                      item?.scale <= translation?.rate
                        ? "scale-105"
                        : "opacity-60"
                    }`}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                    />
                  </svg>
                </button>
              </Tooltip>
            ))}
            <div className="text-lg md:text-xl px-2 opacity-60">
              {translation?.rate}
            </div>
          </div>
        }
      </div>
    </div>
  );
};

export default TranslationOutputArea;
