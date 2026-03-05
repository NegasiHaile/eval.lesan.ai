import { EvalTaskTypes } from "@/types/data";
import Button from "@/components/utils/Button";

type ReviewerPanelProps = {
  evalTask: EvalTaskTypes | null;
  reviewerComment: string;
  setReviewerComment: (value: string) => void;
  savingComment: boolean;
  onSaveComment: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTaskIndex: number;
  totalTasks: number;
  referencePlaceholder?: string;
};

export default function ReviewerPanel({
  evalTask,
  reviewerComment,
  setReviewerComment,
  savingComment,
  onSaveComment,
  onNext,
  onPrev,
  currentTaskIndex,
  totalTasks,
  referencePlaceholder = "Reference",
}: ReviewerPanelProps) {
  return (
    <>
      {/* Reference (always visible, read-only in reviewer mode) */}
      <textarea
        key={evalTask?.id}
        id={`id_${evalTask?.id}`}
        placeholder={referencePlaceholder}
        className="w-full p-3 h-fit min-h-45 md:min-h-36 rounded-md bg-neutral-100 border border-neutral-300 dark:bg-neutral-800/80 dark:border-neutral-700/80 dark:text-white placeholder:text-sm placeholder:font-mono cursor-not-allowed opacity-80"
        name="reference"
        value={evalTask?.reference ?? ""}
        readOnly
      />

      {/* Reviewer comment textarea */}
      <div className="space-y-2">
        <label className="text-sm font-mono font-semibold text-neutral-600 dark:text-neutral-400">
          Reviewer Comment
        </label>
        <textarea
          placeholder="Add your review comment for this task..."
          className="w-full p-3 h-fit min-h-28 rounded-md bg-neutral-50 border border-blue-300 dark:bg-neutral-800/80 dark:border-blue-700/80 dark:text-white focus:outline-blue-500 placeholder:text-sm placeholder:font-mono"
          value={reviewerComment}
          onChange={(e) => setReviewerComment(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between space-x-2 font-mono">
        <Button
          variant="primary"
          size="sm"
          onClick={onSaveComment}
          loading={savingComment}
          className="!font-semibold"
        >
          Save Comment
        </Button>

        <div className="flex items-center justify-end space-x-2 text-right">
          {currentTaskIndex > 0 && (
            <Button
              onClick={onPrev}
              outline
              size="sm"
              text="Prev"
              className="!px-5 !text-current !font-semibold"
            />
          )}
          <span className="text-sm font-bold">
            {currentTaskIndex + 1}/{totalTasks}
          </span>
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
    </>
  );
}
