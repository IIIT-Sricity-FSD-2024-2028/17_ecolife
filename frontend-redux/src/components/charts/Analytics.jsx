import React from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, Pie, PieChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { fmtNum } from '../../utils/formatters';

/* One colour per scope, fixed for the whole app (checked for colour-blind separation).
   Scope 1 green, Scope 2 blue, Scope 3 amber. Single-series charts use the brand green. */
export const SCOPE_COLOR = { SCOPE_1: '#0B4A3B', SCOPE_2: '#1E9E78', SCOPE_3: '#8ED1B6' };
export const SCOPE_LABEL = { SCOPE_1: 'Fuel burned on site (Scope 1)', SCOPE_2: 'Electricity bought (Scope 2)', SCOPE_3: 'Suppliers and purchases (Scope 3)' };
export const BRAND = '#047857';
const INK = '#52514e';
const MUTED = '#7FA392';
const GRID = '#e1e0d9';
const tip = { borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(6,39,31,.94)', boxShadow: '0 12px 28px -10px rgba(4,30,24,.55)', fontSize: 13, color: '#fff' };
const tipItem = { color: '#E6FBF1' };
const tipLabel = { color: '#9BE5C6', marginBottom: 2 };
const tick = { fontSize: 12, fill: MUTED };
const legendInk = (v) => <span style={{ color: INK }}>{v}</span>;

const GRAD_COLORS = ['#0B4A3B', '#1E9E78', '#8ED1B6', '#047857', '#BFDCCD', '#7FA392', '#4C8E75', '#D9A23A'];
const mix = (hex, amt) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * amt)); return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`; };
const grad = (hex) => hex;
/** Soft top-to-bottom shading for bars, so the marks have some depth but stay one hue. */
function GradDefs() {
  return <defs>{GRAD_COLORS.map((c) => <linearGradient key={c} id={`gr-${c.slice(1).toLowerCase()}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={mix(c, 0.22)} /><stop offset="1" stopColor={c} /></linearGradient>)}</defs>;
}

function Frame({ height, label, children }) {
  return <div style={{ height }} role="img" aria-label={label}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
}

/** Monthly emissions stacked by scope, with the same month a year earlier as a dashed line. data = [{label, scope1, scope2, scope3, prevYearTotal}] */
export function ScopeTrend({ data, unit = 'tCO₂e', height = 330, showPrev = true, withScope3 = false }) {
  const hasS3 = withScope3 && data.some((d) => d.scope3 > 0);
  const hasPrev = showPrev && data.some((d) => d.prevYearTotal != null);
  return (
    <Frame height={height} label={`Monthly ${unit} by scope`}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <GradDefs />
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 5" />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#c3c2b7' }} tick={tick} interval="preserveStartEnd" minTickGap={18} />
        <YAxis tickLine={false} axisLine={false} tick={tick} width={64} tickFormatter={(v) => fmtNum(v, 0)} />
        <Tooltip cursor={{ fill: 'rgba(5,150,105,.08)' }} contentStyle={tip} itemStyle={tipItem} labelStyle={tipLabel} formatter={(v, n) => [`${fmtNum(v)} ${unit}`, n]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={legendInk} />
        <Bar isAnimationActive={false} dataKey="scope1" name="Fuel on site (Scope 1)" stackId="s" fill={grad(SCOPE_COLOR.SCOPE_1)} stroke="#fcfcfb" strokeWidth={2} />
        <Bar isAnimationActive={false} dataKey="scope2" name="Electricity (Scope 2)" stackId="s" fill={grad(SCOPE_COLOR.SCOPE_2)} stroke="#fcfcfb" strokeWidth={2} radius={hasS3 ? 0 : [4, 4, 0, 0]} />
        {hasS3 && <Bar isAnimationActive={false} dataKey="scope3" name="Purchases (Scope 3)" stackId="s" fill={grad(SCOPE_COLOR.SCOPE_3)} stroke="#fcfcfb" strokeWidth={2} radius={[4, 4, 0, 0]} />}
        {hasPrev && <Line isAnimationActive={false} type="monotone" dataKey="prevYearTotal" name="Same month last year (Scope 1+2)" stroke={INK} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} />}
      </ComposedChart>
    </Frame>
  );
}

/** Ranked horizontal bars, optionally stacked by scope. rows = [{label, value}] or [{label, scope1, scope2}] */
export function RankBars({ rows, unit = 'tCO₂e', stacked = false, height, formatter = (v) => fmtNum(v), axis = (v) => fmtNum(v, 0) }) {
  const h = height || Math.max(230, rows.length * 34 + 40);
  return (
    <Frame height={h} label={`Ranked ${unit}`}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
        <GradDefs />
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tickLine={false} axisLine={false} tick={tick} tickFormatter={axis} />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={132} tick={{ fontSize: 12, fill: INK }} interval={0} tickFormatter={(v) => (String(v).length > 19 ? `${String(v).slice(0, 18)}…` : v)} />
        <Tooltip cursor={{ fill: 'rgba(5,150,105,.08)' }} contentStyle={tip} itemStyle={tipItem} labelStyle={tipLabel} formatter={(v, n) => [`${formatter(v)} ${unit}`.trim(), n]} />
        {stacked ? (
          <>
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={legendInk} />
            <Bar isAnimationActive={false} dataKey="scope1" name="Fuel on site (Scope 1)" stackId="s" fill={grad(SCOPE_COLOR.SCOPE_1)} stroke="#fcfcfb" strokeWidth={2} />
            <Bar isAnimationActive={false} dataKey="scope2" name="Electricity (Scope 2)" stackId="s" fill={grad(SCOPE_COLOR.SCOPE_2)} stroke="#fcfcfb" strokeWidth={2} radius={[0, 4, 4, 0]} />
          </>
        ) : <Bar isAnimationActive={false} dataKey="value" name={unit} fill={grad('#047857')} radius={[0, 6, 6, 0]} />}
      </BarChart>
    </Frame>
  );
}

/** A plain multi-line chart. lines = [{key, label, color?}] */
export function Lines({ data, lines, unit = '', height = 220, area = false, xKey = 'label' }) {
  const cols = [BRAND, SCOPE_COLOR.SCOPE_2, SCOPE_COLOR.SCOPE_3];
  return (
    <Frame height={height} label={lines.map((l) => l.label).join(', ')}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 5" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} tick={tick} interval="preserveStartEnd" minTickGap={18} />
        <YAxis tickLine={false} axisLine={false} tick={tick} width={56} tickFormatter={(v) => fmtNum(v, 0)} allowDecimals={false} />
        <Tooltip contentStyle={tip} itemStyle={tipItem} labelStyle={tipLabel} formatter={(v, n) => [`${fmtNum(v)}${unit ? ` ${unit}` : ''}`, n]} />
        {lines.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={legendInk} />}
        {lines.map((l, i) => (area && i === 0
          ? <Area isAnimationActive={false} key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color || cols[i]} strokeWidth={2} fill={l.color || cols[i]} fillOpacity={0.14} dot={false} />
          : <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color || cols[i % 3]} strokeWidth={2} dot={false} />))}
      </ComposedChart>
    </Frame>
  );
}

/** Columns grouped or stacked. series = [{key, label, color}] */
export function Columns({ data, series, unit = '', height = 240, stacked = true, yFormat = (v) => fmtNum(v, 0) }) {
  return (
    <Frame height={height} label={series.map((s) => s.label).join(', ')}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <GradDefs />
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 5" />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#c3c2b7' }} tick={tick} interval="preserveStartEnd" minTickGap={12} />
        <YAxis tickLine={false} axisLine={false} tick={tick} width={60} tickFormatter={yFormat} allowDecimals={false} />
        <Tooltip cursor={{ fill: 'rgba(5,150,105,.08)' }} contentStyle={tip} itemStyle={tipItem} labelStyle={tipLabel} formatter={(v, n) => [`${yFormat(v)}${unit ? ` ${unit}` : ''}`, n]} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={legendInk} />}
        {series.map((s, i) => <Bar isAnimationActive={false} key={s.key} dataKey={s.key} name={s.label} stackId={stacked ? 'a' : undefined} fill={grad(s.color)} stroke={stacked ? '#fcfcfb' : undefined} strokeWidth={stacked ? 2 : 0} radius={!stacked || i === series.length - 1 ? [4, 4, 0, 0] : 0} />)}
      </BarChart>
    </Frame>
  );
}

/** One whole split into a few parts, with a legend that carries the figures. parts = [{key, label, value, color}] */
export function SplitBar({ parts, unit = '', format = (v) => fmtNum(v, 0), single = false }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return null;
  return (
    <div>
      <div className="flex h-6 w-full gap-0.5 overflow-hidden rounded-lg" role="img" aria-label={parts.map((p) => `${p.label} ${format(p.value)}`).join(', ')}>
        {parts.filter((p) => p.value > 0).map((p) => <div key={p.key} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${format(p.value)} ${unit}`} />)}
      </div>
      <ul className={`mt-3 grid gap-x-6 gap-y-1.5 text-sm ${single ? '' : 'sm:grid-cols-2'}`}>
        {parts.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-text"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} aria-hidden />{p.label}</span>
            <span className="tabular-nums text-text">{format(p.value)} <span className="text-xs text-muted">{Math.round((p.value / total) * 100)}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A used-against-limit bar (seats, sites, certificate balance). */
export function Meter({ label, used, max, note, warnAt = 0.85 }) {
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  const hot = max > 0 && used / max >= warnAt;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm"><span className="font-medium text-text">{label}</span><span className="tabular-nums text-text">{fmtNum(used, 0)} <span className="text-muted text-xs">of {max >= 999 ? 'unlimited' : fmtNum(max, 0)}</span></span></div>
      <div className="mt-1.5 h-2.5 rounded-full bg-brand-50 overflow-hidden" role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className={`h-full rounded-full ${hot ? 'bg-saffron-600' : 'bg-brand-600'}`} style={{ width: `${Math.max(max >= 999 ? 2 : 3, max >= 999 ? Math.min(pct * 8, 100) : pct)}%` }} />
      </div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </div>
  );
}

/** A headline number with a change against the earlier period and a small trend line. delta = % change; goodWhen = 'down' | 'up'. */
export function KpiTile({ label, value, unit, delta, goodWhen = 'down', spark, note, icon: Icon }) {
  const has = delta != null && Number.isFinite(delta);
  const up = has && delta > 0.05;
  const down = has && delta < -0.05;
  const good = (up && goodWhen === 'up') || (down && goodWhen === 'down');
  const bad = (up && goodWhen === 'down') || (down && goodWhen === 'up');
  const Arrow = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const id = React.useId().replace(/:/g, '');
  return (
    <div className="card px-4 py-4 min-w-0 relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-muted leading-snug pt-1">{label}</div>
        {Icon && <span className="icon-chip"><Icon className="w-[18px] h-[18px]" strokeWidth={1.9} /></span>}
      </div>
      <div className="mt-2 text-[1.75rem] sm:text-[2rem] leading-none font-semibold tracking-tight tabular-nums text-text break-words">{value}{unit && <span className="ml-1.5 text-sm font-normal text-muted tracking-normal">{unit}</span>}</div>
      {has && <div className="mt-2.5"><span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${good ? 'bg-ok-50 text-ok-600' : bad ? 'bg-saffron-50 text-saffron-600' : 'bg-brand-50 text-muted'}`}><Arrow className="w-3.5 h-3.5 shrink-0" aria-hidden />{Math.abs(delta) >= 1000 ? 'Over 1,000%' : `${Math.abs(delta).toFixed(1)}%`}</span> <span className="text-xs text-muted">{up ? 'higher' : down ? 'lower' : 'unchanged'} than last month</span></div>}
      {note && <div className="mt-2 text-xs text-muted">{note}</div>}
      {spark && spark.length > 1 && <div className="mt-3 h-10 -mx-1" aria-hidden><ResponsiveContainer width="100%" height="100%"><AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}><defs><linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1E9E78" stopOpacity=".3" /><stop offset="1" stopColor="#1E9E78" stopOpacity="0" /></linearGradient></defs><Area isAnimationActive={false} type="monotone" dataKey="v" stroke={BRAND} strokeWidth={2} fill={`url(#sp${id})`} dot={false} /></AreaChart></ResponsiveContainer></div>}
    </div>
  );
}

/** Actual against the straight-line path from the base year to the target. */
export function TargetPath({ target, height = 220 }) {
  const years = [target.baseYear, ...target.milestones.map((m) => m.financialYear).filter((y) => y !== target.baseYear && y !== target.targetYear), target.targetYear];
  const idx = (y) => years.indexOf(y);
  const last = years.length - 1;
  const data = years.map((y, i) => {
    const m = target.milestones.find((x) => x.financialYear === y);
    const path = target.baseValue + ((target.targetValue - target.baseValue) * i) / (last || 1);
    return { label: y.replace('FY', ''), path: Number(path.toFixed(2)), actual: y === target.baseYear ? target.baseValue : m?.actual ?? null };
  });
  return (
    <Frame height={height} label={`${target.name}: planned path and actual`}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 5" />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#c3c2b7' }} tick={tick} />
        <YAxis tickLine={false} axisLine={false} tick={tick} width={60} tickFormatter={(v) => fmtNum(v, 0)} domain={[0, 'auto']} />
        <Tooltip contentStyle={tip} itemStyle={tipItem} labelStyle={tipLabel} formatter={(v, n) => [`${fmtNum(v)} ${target.intensityUnit || 'tCO₂e'}`, n]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={legendInk} />
        <ReferenceLine y={target.targetValue} stroke={MUTED} strokeDasharray="2 4" label={{ value: 'Goal', position: 'insideTopRight', fontSize: 11, fill: INK }} />
        <Line isAnimationActive={false} type="linear" dataKey="path" name="Planned path" stroke={MUTED} strokeWidth={2} strokeDasharray="5 4" dot={false} />
        <Line isAnimationActive={false} type="linear" dataKey="actual" name="Actual" stroke={BRAND} strokeWidth={2.5} dot={{ r: 4, fill: BRAND, stroke: '#fcfcfb', strokeWidth: 2 }} connectNulls />
      </LineChart>
    </Frame>
  );
}

/** Cost-curve of reduction projects: width is the tonnes saved, height is the rupees per tonne. Left to right, cheapest first. */
export function CostCurve({ items, height = 260 }) {
  const rows = items.filter((i) => i.macInrPerTco2e != null && i.expectedTco2e > 0).sort((a, b) => a.macInrPerTco2e - b.macInrPerTco2e);
  if (!rows.length) return null;
  const total = rows.reduce((s, r) => s + r.expectedTco2e, 0);
  const costs = rows.map((r) => r.macInrPerTco2e);
  const hi = Math.max(...costs, 0);
  const lo = Math.min(...costs, 0);
  const W = 640; const H = height; const padL = 56; const padB = 28; const padT = 10; const padR = 8;
  const pw = W - padL - padR; const ph = H - padT - padB;
  const y = (v) => padT + ph - ((v - lo) / (hi - lo || 1)) * ph;
  const y0 = y(0);
  let x = padL;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Reduction projects ordered by cost per tonne saved">
      <line x1={padL} x2={W - padR} y1={y0} y2={y0} stroke="#c3c2b7" />
      <text x={padL - 8} y={y(hi) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{fmtNum(hi, 0)}</text>
      {lo < 0 && <text x={padL - 8} y={y(lo)} textAnchor="end" fontSize="11" fill={MUTED}>{fmtNum(lo, 0)}</text>}
      <text x={padL - 8} y={y0 + 4} textAnchor="end" fontSize="11" fill={MUTED}>0</text>
      <text x={padL} y={H - 6} fontSize="11" fill={MUTED}>₹ per tonne saved (height) · tonnes saved (width)</text>
      {rows.map((r) => {
        const w = Math.max(3, (r.expectedTco2e / total) * pw);
        const top = Math.min(y(r.macInrPerTco2e), y0);
        const h = Math.max(2, Math.abs(y(r.macInrPerTco2e) - y0));
        const cx = x; x += w;
        return (
          <g key={r.id}>
            <rect x={cx + 1} y={top} width={Math.max(1, w - 2)} height={h} rx="3" fill={r.macInrPerTco2e <= 0 ? SCOPE_COLOR.SCOPE_1 : BRAND} opacity={r.macInrPerTco2e <= 0 ? 0.9 : 0.75}><title>{`${r.title}: ${fmtNum(r.expectedTco2e)} tCO₂e, ₹${fmtNum(r.macInrPerTco2e, 0)} per tonne`}</title></rect>
            {w > 54 && <text x={cx + w / 2} y={top - 4} textAnchor="middle" fontSize="10.5" fill={INK}>{String(r.title).slice(0, Math.floor(w / 6.2))}</text>}
          </g>
        );
      })}
    </svg>
  );
}


/** Share of a whole as a ring, with the total in the middle and each part listed beside it. */
export function Donut({ parts, unit, size = 168, digits = 0 }) {
  const live = parts.filter((p) => p.value > 0);
  const total = live.reduce((a, p) => a + p.value, 0);
  if (!total) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={live.map((p) => `${p.label} ${fmtNum(p.value, digits)} ${unit}`).join(', ')}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie isAnimationActive={false} data={live} dataKey="value" nameKey="label" innerRadius="66%" outerRadius="100%" paddingAngle={live.length > 1 ? 2 : 0} stroke="none" startAngle={90} endAngle={-270}>
              {live.map((p) => <Cell key={p.key} fill={p.color} />)}
            </Pie>
            <Tooltip contentStyle={tip} itemStyle={tipItem} labelStyle={tipLabel} formatter={(v, n) => [`${fmtNum(v, digits)} ${unit}`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-[1.5rem] font-semibold leading-none tabular-nums text-text">{fmtNum(total, digits)}</div>
          <div className="mt-1 text-xs text-muted">{unit}</div>
        </div>
      </div>
      <ul className="min-w-[10rem] flex-1 space-y-2 text-sm">
        {live.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-text"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.label}</span>
            <span className="tabular-nums text-text">{fmtNum(p.value, digits)} <span className="text-xs text-muted">{fmtNum((p.value / total) * 100, 0)}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const HEAT = ['#EAF3EE', '#BFDCCD', '#8ED1B6', '#1E9E78', '#0B4A3B'];
/** One square per day, a column per week, darker when more happened. */
export function HeatDays({ days, unit = 'actions' }) {
  if (!days?.length) return null;
  const max = Math.max(...days.map((d) => d.count), 1);
  const level = (n) => (n <= 0 ? 0 : Math.min(4, 1 + Math.floor((n / max) * 3.999)));
  const first = new Date(days[0].day);
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const cells = [...Array(lead).fill(null), ...days];
  const weeks = Math.ceil(cells.length / 7);
  return (
    <div>
      <div className="flex gap-3">
        <div className="grid grid-rows-7 gap-1.5 text-[11px] leading-none text-muted shrink-0" aria-hidden>{['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => <div key={i} className="h-7 flex items-center">{d}</div>)}</div>
        <div className="grid grid-flow-col grid-rows-7 gap-1.5 flex-1 min-w-0" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }} role="img" aria-label={`Actions logged per day: ${days.map((d) => `${d.label} ${d.count}`).join(', ')}`}>
          {cells.map((d, i) => d ? <div key={i} title={`${d.label}: ${d.count} ${unit}`} className="h-7 rounded-[6px]" style={{ background: HEAT[level(d.count)] }} /> : <div key={i} className="h-7" />)}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted"><span>Fewer</span>{HEAT.map((c) => <span key={c} className="h-3.5 w-3.5 rounded-[4px]" style={{ background: c }} />)}<span>More</span><span className="ml-auto">Busiest day: {fmtNum(max, 0)} {unit}</span></div>
    </div>
  );
}

/** Usage against a limit as rings. A limit of 999 or more means no practical limit. */
export function Rings({ items }) {
  return (
    <div className="flex flex-wrap gap-x-10 gap-y-6">
      {items.map((it) => {
        const unlimited = !(it.max > 0) || it.max >= 999;
        const frac = unlimited ? 0 : Math.min(1, it.used / it.max);
        const hot = !unlimited && frac >= 0.85;
        const r = 44; const c = 2 * Math.PI * r;
        return (
          <div key={it.label} className="flex items-center gap-4">
            <svg width="104" height="104" viewBox="0 0 104 104" role="meter" aria-label={it.label} aria-valuenow={it.used} aria-valuemin={0} aria-valuemax={unlimited ? undefined : it.max}>
              <circle cx="52" cy="52" r={r} fill="none" stroke="#E4EEE8" strokeWidth="10" />
              {frac > 0 && <circle cx="52" cy="52" r={r} fill="none" stroke={hot ? '#C9801A' : '#1E9E78'} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 52 52)" />}
              <text x="52" y="57" textAnchor="middle" className="fill-[#10231C]" style={{ fontSize: 20, fontWeight: 600 }}>{fmtNum(it.used, 0)}</text>
            </svg>
            <div className="text-sm">
              <div className="font-medium text-text">{it.label}</div>
              <div className="text-muted">{unlimited ? 'No limit on your plan' : `of ${fmtNum(it.max, 0)} allowed`}</div>
              {it.note && <div className="mt-1 text-xs text-muted max-w-[11rem]">{it.note}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
