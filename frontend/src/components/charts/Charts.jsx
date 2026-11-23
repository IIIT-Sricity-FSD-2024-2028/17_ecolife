import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { fmtNum } from '../../utils/formatters';

// One green family. Emerald for the main series, deep forest and sage for the others.
export const SERIES = ['#047857', '#0A4D3C', '#9DB8A0'];

/** Stacked monthly bars. series = [{key, label}], data = [{label, ...values}] */
export function MonthlyBars({ data, series, unit = 'tCO₂e', height = 240 }) {
  return (
    <div style={{ height }} role="img" aria-label={`Monthly ${unit} by ${series.map((s) => s.label).join(' and ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, left: -8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#E3EBE6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5C6F66' }} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5C6F66' }} width={52} tickFormatter={(v) => fmtNum(v, 0)} />
          <Tooltip cursor={{ fill: 'rgba(5,150,105,.08)' }} formatter={(v, n) => [`${fmtNum(v)} ${unit}`, n]} contentStyle={{ borderRadius: 8, border: '1px solid #D5E0D9', fontSize: 13 }} />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />}
          {series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={SERIES[i % SERIES.length]} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal share bars: label, bar, value. rows = [{key,label,value,sub}] */
export function ShareBars({ rows, unit = 'tCO₂e', onPick }) {
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-text truncate">{r.label}</span>
              <span className="tabular-nums text-text shrink-0">{fmtNum(r.value)} <span className="text-muted text-xs">{unit} · {Math.round((r.value / total) * 100)}%</span></span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-brand-50 overflow-hidden"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></div>
            {r.sub && <div className="mt-1 text-xs text-muted">{r.sub}</div>}
          </>
        );
        return <li key={r.key}>{onPick ? <button type="button" onClick={() => onPick(r)} className="block w-full text-left rounded-md hover:bg-brand-50 -mx-2 px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{body}</button> : body}</li>;
      })}
    </ul>
  );
}
