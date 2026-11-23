import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Inbox, RefreshCw, TriangleAlert } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';

const SIZES = [10, 25, 50, 100];
const MAX_EXPORT = 5000;

/**
 * Table that never holds more than one page in the browser. The server does the paging and filtering
 * (see GET ?page=&pageSize=). Columns: { key, label, numeric, render(row), value(row), hideOnMobile }.
 *  - numbers are right-aligned with tabular figures, units belong in the label
 *  - one toolbar row: filters on the left, export on the right
 *  - below 720px each row becomes a small card
 */
export function DataGrid({
  endpoint, params = {}, columns, rowKey = (r) => r.id, toolbar = null, refreshKey = 0,
  emptyTitle = 'Nothing here yet', emptyText = '', emptyAction = null, exportName = 'tropos-export', initialPageSize = 25, onRows
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [state, setState] = useState({ items: [], total: 0, totalPages: 1, loading: true, error: '' });
  const [exporting, setExporting] = useState(false);
  const [retry, setRetry] = useState(0);
  const paramKey = JSON.stringify(params);
  const first = useRef(true);

  const url = useCallback((p, size) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== undefined && v !== null) q.set(k, v); });
    q.set('page', p); q.set('pageSize', size);
    return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${q}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, paramKey]);

  // a new filter always starts at page 1
  useEffect(() => { if (first.current) { first.current = false; return; } setPage(1); }, [paramKey, pageSize]);

  useEffect(() => {
    const ctl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: '' }));
    apiFetch(url(page, pageSize), { signal: ctl.signal })
      .then((r) => { setState({ items: r.items, total: r.total, totalPages: r.totalPages, loading: false, error: '' }); onRows?.(r.items); })
      .catch((e) => { if (e.name !== 'AbortError') setState((s) => ({ ...s, loading: false, error: e.message || 'Could not load this list.' })); });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, page, pageSize, refreshKey, retry]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      let rows = []; let p = 1; let tp = 1;
      do {
        const r = await apiFetch(url(p, 100)); rows = rows.concat(r.items); tp = r.totalPages; p += 1;
      } while (p <= tp && rows.length < MAX_EXPORT);
      const esc = (v) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const cols = columns.filter((c) => c.label);
      const csv = [cols.map((c) => esc(c.label)).join(','), ...rows.map((r) => cols.map((c) => esc(c.value ? c.value(r) : r[c.key])).join(','))].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `${exportName}.csv`; a.click(); URL.revokeObjectURL(a.href);
    } finally { setExporting(false); }
  };

  const from = state.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, state.total);
  const labelled = useMemo(() => columns.filter((c) => c.label), [columns]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">{toolbar}</div>
        <button type="button" className="btn-secondary btn-sm" onClick={exportCsv} disabled={exporting || state.total === 0}>
          <Download className="w-4 h-4" /> {exporting ? 'Preparing…' : 'Export'}
        </button>
      </div>

      {state.error ? (
        <div className="px-4 py-10 text-center">
          <TriangleAlert className="w-8 h-8 mx-auto text-saffron-600" />
          <p className="mt-2 text-sm font-medium">{state.error}</p>
          <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => { setState((s) => ({ ...s, error: '', loading: true })); setPage((p) => (p === 1 ? 1 : p)); setRetry((n) => n + 1); }}><RefreshCw className="w-4 h-4" /> Try again</button>
        </div>
      ) : state.loading && state.items.length === 0 ? (
        <div className="px-4 py-3" aria-busy="true" aria-label="Loading">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-11 my-1 rounded-md bg-brand-50 animate-pulse" />)}
        </div>
      ) : state.items.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <Inbox className="w-9 h-9 mx-auto text-subtle" />
          <h3 className="mt-3 text-base font-semibold">{emptyTitle}</h3>
          {emptyText && <p className="mt-1 text-sm text-muted max-w-md mx-auto">{emptyText}</p>}
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-[0.93rem]">
              <thead>
                <tr className="bg-brand-50 text-muted text-[0.82rem]">
                  {columns.map((c, i) => <th key={c.key || i} scope="col" className={`px-4 py-2.5 font-medium whitespace-nowrap ${c.numeric ? 'text-right' : 'text-left'}`}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody className={state.loading ? 'opacity-60' : ''}>
                {state.items.map((r) => (
                  <tr key={rowKey(r)} className="h-11 border-t border-line hover:bg-brand-50/60">
                    {columns.map((c, i) => <td key={c.key || i} className={`px-4 py-1.5 align-middle ${c.numeric ? 'text-right tabular-nums whitespace-nowrap' : ''}`}>{c.render ? c.render(r) : r[c.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className={`md:hidden divide-y divide-line ${state.loading ? 'opacity-60' : ''}`}>
            {state.items.map((r) => (
              <li key={rowKey(r)} className="px-4 py-3 space-y-1.5">
                {labelled.filter((c) => !c.hideOnMobile).map((c) => (
                  <div key={c.key} className="flex justify-between gap-3 text-sm"><span className="text-muted shrink-0">{c.label}</span><span className="text-right min-w-0">{c.render ? c.render(r) : r[c.key]}</span></div>
                ))}
                {columns.filter((c) => !c.label).map((c, i) => <div key={`a${i}`} className="pt-1 flex justify-end">{c.render?.(r)}</div>)}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-line text-sm text-muted">
        <span>{state.total === 0 ? 'No records' : `Showing ${from}–${to} of ${state.total.toLocaleString('en-IN')}`}</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">Rows
            <select className="select !min-h-8 !w-auto !px-2 text-sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="Rows per page">
              {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <button type="button" className="btn-ghost btn-sm !px-2" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="w-4 h-4" /></button>
            <span className="tabular-nums px-1">{page} / {state.totalPages}</span>
            <button type="button" className="btn-ghost btn-sm !px-2" disabled={page >= state.totalPages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
