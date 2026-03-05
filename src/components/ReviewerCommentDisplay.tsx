type ReviewerCommentDisplayProps = {
  comment: string;
};

export default function ReviewerCommentDisplay({ comment }: ReviewerCommentDisplayProps) {
  if (!comment) return null;

  return (
    <div className="space-y-1 p-3 rounded-md bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
      <p className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
        Reviewer Comment
      </p>
      <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
        {comment}
      </p>
    </div>
  );
}
