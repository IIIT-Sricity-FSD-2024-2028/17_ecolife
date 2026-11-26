import React from 'react';
import { Card, EmptyState } from '../../../components/ui';
import { FileSearch } from 'lucide-react';
import { fmtNum } from '../../../utils/formatters';

export const short = (label) => String(label || '').replace(/\s(\d{4})$/, (_, y) => ` ’${y.slice(2)}`);

/** Months worth drawing: from the first month with approved data to the latest, at most the last 18. */
export function activeMonths(monthly = []) {
  const firstWith = monthly.findIndex((m) => m.total > 0 || m.scope3 > 0);
  const from = firstWith < 0 ? Math.max(0, monthly.length - 6) : firstWith;
  let to = monthly.length;
  while (to > from + 1 && !(monthly[to - 1].total > 0 || monthly[to - 1].scope3 > 0) && monthly[to - 1].status !== 'OPEN') to -= 1;
  return monthly.slice(from, to).slice(-18).map((m) => ({ ...m, label: short(m.label) }));
}

/** Latest month with data against the one before it, as a percentage. Null when there is nothing to compare. */
export function monthDelta(rows, key = 'total') {
  // A month still being filled in would always look like a collapse, so compare the finished months.
  const withData = rows.filter((r) => r[key] > 0 && r.status && r.status !== 'OPEN');
  if (withData.length < 2) return null;
  const a = withData[withData.length - 1][key];
  const b = withData[withData.length - 2][key];
  return b > 0 ? ((a - b) / b) * 100 : null;
}

export function Skeleton() {
  return <div className="space-y-4"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="card h-28 animate-pulse" />)}</div><div className="card h-72 animate-pulse" /></div>;
}

export function Empty({ title = 'No approved data yet', children = 'Charts appear here once records are approved.' }) {
  return <EmptyState icon={FileSearch} title={title}>{children}</EmptyState>;
}

export function Panel({ title, description, children, className = '', actions }) {
  return <Card title={title} description={description} className={`min-w-0 ${className}`} actions={actions}>{children}</Card>;
}

export const sum = (rows, k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
export { fmtNum };

export const STATUS_COLOR = { DRAFT: '#BFDCCD', SUBMITTED: '#1E9E78', APPROVED: '#0B4A3B', REJECTED: '#D9A23A' };
export const STATUS_LABEL = { DRAFT: 'Saved, not sent', SUBMITTED: 'Waiting for review', APPROVED: 'Approved', REJECTED: 'Sent back' };

const DOMAIN = { FUEL: 'Fuel', ELECTRICITY_THERMAL: 'Electricity and heat', REFRIGERANT: 'Cooling gases', WATER: 'Water', WASTE: 'Waste', AIR_EMISSION: 'Air emissions', RAW_MATERIAL: 'Raw materials', LAND_GREENBELT: 'Land and greenery' };
const human = (x) => String(x || '').toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
/** "Fuel · Liquid fossil" from the two parts the backend sends. */
export const sourceLabel = (r) => `${DOMAIN[r.domain] || human(r.domain)}${r.fuelCategory ? ` · ${human(r.fuelCategory)}` : ''}${r.scope ? ` (Scope ${String(r.scope).slice(-1)})` : ''}`;

/** A short table inside a panel. cols = [{ h: heading, c: row => cell, right?: true }]. Scrolls sideways on a phone. */
export function MiniTable({ cols, rows, empty, more }) {
  if (!rows?.length) return empty || <Empty title="Nothing here yet" />;
  return (
    <div>
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-sm min-w-[32rem]">
          <thead><tr className="text-left text-xs text-muted border-b border-line">{cols.map((c) => <th key={c.h} scope="col" className={`px-5 py-2 font-medium ${c.right ? 'text-right' : ''}`}>{c.h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{rows.map((r, i) => <tr key={r.id || i}>{cols.map((c) => <td key={c.h} className={`px-5 py-2.5 text-text ${c.right ? 'text-right tabular-nums' : ''}`}>{c.c(r)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {more && <div className="mt-3 text-sm">{more}</div>}
    </div>
  );
}

const pct = (a, b) => (b > 0 ? `${a >= b ? '+' : '−'}${fmtNum(Math.abs(((a - b) / b) * 100), 1)}%` : '—');

/** The same numbers the monthly chart draws, newest first, so a bar can be read exactly. */
export function MonthTable({ months, scope3 = true, limit = 3 }) {
  const rows = months.filter((m) => m.total > 0 || m.scope3 > 0).slice(-limit).reverse();
  if (!rows.length) return null;
  const cols = [
    { h: 'Month', c: (r) => r.label },
    { h: 'Fuel (Scope 1)', right: true, c: (r) => fmtNum(r.scope1, 1) },
    { h: 'Electricity (Scope 2)', right: true, c: (r) => fmtNum(r.scope2, 1) },
    ...(scope3 ? [{ h: 'Purchases (Scope 3)', right: true, c: (r) => fmtNum(r.scope3, 1) }] : []),
    { h: 'Scope 1 + 2', right: true, c: (r) => <span className="font-medium">{fmtNum(r.total, 1)}</span> },
    { h: 'Year on year', right: true, c: (r) => (r.prevYearTotal && r.status !== 'OPEN' ? pct(r.total, r.prevYearTotal) : '—') },
  ];
  return <div className="mt-4 border-t border-line pt-3"><div className="text-sm font-medium text-text mb-1">Month by month, tCO₂e</div><MiniTable cols={cols} rows={rows} /></div>;
}

/** Sites with their figures and share of the total. */
export function SiteTable({ sites, limit = 6 }) {
  const total = sites.reduce((a, s) => a + s.scope1 + s.scope2, 0);
  const rows = sites.filter((s) => s.scope1 + s.scope2 > 0).slice(0, limit);
  if (!rows.length) return null;
  const cols = [
    { h: 'Site', c: (r) => <><div className="font-medium">{r.name}</div>{r.city && <div className="text-xs text-muted">{r.city}</div>}</> },
    { h: 'Fuel', right: true, c: (r) => fmtNum(r.scope1, 1) },
    { h: 'Electricity', right: true, c: (r) => fmtNum(r.scope2, 1) },
    { h: 'Share', right: true, c: (r) => `${fmtNum(((r.scope1 + r.scope2) / total) * 100, 0)}%` },
  ];
  return <div className="mt-4 border-t border-line pt-3"><MiniTable cols={cols} rows={rows} /></div>;
}
