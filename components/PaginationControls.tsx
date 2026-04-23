type PaginationControlsProps = {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  totalCount,
  page,
  pageSize,
  totalPages,
  onPageChange,
}: PaginationControlsProps) {
  if (totalCount === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-c-border bg-c-surface-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-c-text-2">
        총 {totalCount}건 중 {start}-{end}건
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded border border-c-border bg-c-surface px-3 py-1.5 text-sm text-c-text disabled:opacity-50 hover:bg-c-surface-2"
        >
          이전
        </button>
        <span className="text-sm text-c-text-2">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="rounded border border-c-border bg-c-surface px-3 py-1.5 text-sm text-c-text disabled:opacity-50 hover:bg-c-surface-2"
        >
          다음
        </button>
      </div>
    </div>
  );
}
