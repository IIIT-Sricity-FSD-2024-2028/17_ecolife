import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SIZES = [10, 25, 50, 100];

/** Footer for any list that reads one page at a time. The parent keeps page and pageSize in the store. */
export function Pager({ page, pageSize, total, totalPages, onPage, onPageSize }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-line text-sm text-muted">
      <span>{total === 0 ? 'No records' : `Showing ${from}–${to} of ${total.toLocaleString('en-IN')}`}</span>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">Rows
          <select className="select !min-h-8 !w-auto !px-2 text-sm" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page">
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost btn-sm !px-2" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
          <span className="tabular-nums px-1">{page} / {totalPages || 1}</span>
          <button type="button" className="btn-ghost btn-sm !px-2" disabled={page >= (totalPages || 1)} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
