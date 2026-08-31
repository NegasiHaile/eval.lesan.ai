"use client";

import { useEffect, useState } from "react";
import { EvalTaskTypes } from "@/types/data";
import { audioPlaybackSrc } from "@/helpers/audio_playback_url";
import Button from "@/components/utils/Button";

type TTSReviewPanelProps = {
  evalTask: EvalTaskTypes;
  currentTaskIndex: number;
  totalTasks: number;
  saving: boolean;
  onSave: (changes: {
    input: string;
    excluded: boolean;
    reviewer_comment: string;
  }) => void;
  onNext: () => void;
  onPrev: () => void;
};

/**
 * Reviewer pass over a TTS voice-collection batch.
 *
 * A reviewer has exactly two remedies, before or after a take exists: correct
 * the prompt text, or exclude the segment from the dataset. Audio is never
 * edited — when a recording and its text disagree, the text is corrected to
 * match what was said, so saving an edit deliberately keeps the take.
 */
export default function TTSReviewPanel({
  evalTask,
  currentTaskIndex,
  totalTasks,
  saving,
  onSave,
  onNext,
  onPrev,
}: TTSReviewPanelProps) {
  const [text, setText] = useState(evalTask.input ?? "");
  const [excluded, setExcluded] = useState(Boolean(evalTask.excluded));
  const [comment, setComment] = useState(evalTask.reviewer_comment ?? "");

  // Re-seed when the reviewer moves to another segment.
  useEffect(() => {
    setText(evalTask.input ?? "");
    setExcluded(Boolean(evalTask.excluded));
    setComment(evalTask.reviewer_comment ?? "");
  }, [evalTask.id, evalTask.input, evalTask.excluded, evalTask.reviewer_comment]);

  const playbackSrc = evalTask.reference?.trim()
    ? audioPlaybackSrc(evalTask.reference)
    : undefined;

  const textChanged = text.trim() !== (evalTask.input ?? "").trim();
  const excludedChanged = excluded !== Boolean(evalTask.excluded);
  const commentChanged = comment !== (evalTask.reviewer_comment ?? "");
  const dirty = textChanged || excludedChanged || commentChanged;

  // A changed transcript or a dropped segment has to carry its reason.
  const needsReason = textChanged || (excluded && excludedChanged);
  const missingReason = needsReason && !comment.trim();
  const emptyText = !text.trim();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono font-semibold text-neutral-600 dark:text-neutral-400">
          Reviewing segment {currentTaskIndex + 1} / {totalTasks}
        </span>
        {evalTask.reviewed_at && (
          <span className="text-xs font-mono text-neutral-500">
            last reviewed {new Date(evalTask.reviewed_at).toLocaleString()}
          </span>
        )}
      </div>

      {/* The recording, when one exists. Read-only: audio is never edited. */}
      <div className="space-y-2">
        <label className="text-sm font-mono font-semibold text-neutral-600 dark:text-neutral-400">
          Recording
        </label>
        {playbackSrc ? (
          <audio key={evalTask.reference} controls src={playbackSrc} className="w-full" />
        ) : (
          <p className="text-sm text-neutral-500 italic">
            Not recorded yet — you are reviewing this segment before it reaches a reader.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-mono font-semibold text-neutral-600 dark:text-neutral-400">
          Prompt text
        </label>
        <textarea
          className="w-full p-3 min-h-40 rounded-md bg-neutral-50 border border-blue-300 dark:bg-neutral-800/80 dark:border-blue-700/80 dark:text-white focus:outline-blue-500 text-lg leading-relaxed"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {playbackSrc && textChanged && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            The existing recording is kept. Make the text match what the reader
            actually said.
          </p>
        )}
        {emptyText && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Prompt text cannot be empty — exclude the segment instead.
          </p>
        )}
      </div>

      <label className="flex items-start gap-3 p-3 rounded-md border border-neutral-300 dark:border-neutral-700 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1"
          checked={excluded}
          onChange={(e) => setExcluded(e.target.checked)}
        />
        <span className="text-sm">
          <span className="font-semibold">Exclude this segment from the dataset</span>
          <span className="block text-neutral-500">
            Use when the text is unfit to record, or the take cannot be salvaged by
            correcting the text. Readers are not asked to record excluded segments.
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <label className="text-sm font-mono font-semibold text-neutral-600 dark:text-neutral-400">
          Reviewer remark {needsReason && <span className="text-red-500">*</span>}
        </label>
        <textarea
          placeholder="Why are you changing or excluding this segment?"
          className="w-full p-3 min-h-24 rounded-md bg-neutral-50 border border-neutral-300 dark:bg-neutral-800/80 dark:border-neutral-700/80 dark:text-white focus:outline-blue-500 placeholder:text-sm placeholder:font-mono"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {missingReason && (
          <p className="text-xs text-red-600 dark:text-red-400">
            A remark is required when you change the text or exclude a segment.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between font-mono">
        <Button
          variant="primary"
          size="sm"
          loading={saving}
          disabled={!dirty || missingReason || emptyText}
          onClick={() =>
            onSave({ input: text.trim(), excluded, reviewer_comment: comment })
          }
          className="!font-semibold"
        >
          Save review
        </Button>

        <div className="flex items-center gap-2">
          {currentTaskIndex > 0 && (
            <Button
              onClick={onPrev}
              outline
              size="sm"
              text="Prev"
              className="!px-5 !text-current !font-semibold"
            />
          )}
          <Button
            outline
            size="sm"
            onClick={onNext}
            className="!px-5 !text-current !font-semibold"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
