import { ChevronLeft, ChevronRight } from "lucide-react";

/** Prev / next pager driven by the API's `meta` ({ page, limit, total, totalPages }). */
function Pagination({ meta, onPageChange }) {
  if (!meta || meta.totalPages <= 1) return null;
  const { page, limit, total, totalPages } = meta;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const btn =
    "inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
      <p className="text-sm text-slate-500">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <span className="text-sm text-slate-500">
          Page {page} of {totalPages}
        </span>
        <button className={btn} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
