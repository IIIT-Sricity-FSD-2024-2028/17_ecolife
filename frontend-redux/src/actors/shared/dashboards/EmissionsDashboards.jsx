import React from 'react';
import { Link } from 'react-router-dom';
import { Flame, Gauge, Hourglass, TrendingDown, Zap, Wallet, Target as TargetIcon, ShieldCheck } from 'lucide-react';
import { useApi } from '../../../hooks/useApi';
import { ShareBars } from '../../../components/charts/Charts';
import { Columns, Donut, KpiTile, Meter, RankBars, SCOPE_COLOR, SCOPE_LABEL, ScopeTrend, SplitBar, TargetPath } from '../../../components/charts/Analytics';
import { StatusBadge, humanize } from '../../../components/ui';
import { fmtDate, fmtInr, fmtInrShort, fmtNum } from '../../../utils/formatters';
import TodoPanel from './TodoPanel';
import { Empty, MiniTable, MonthTable, Panel, SiteTable, STATUS_COLOR, STATUS_LABEL, Skeleton, activeMonths, monthDelta, sourceLabel, sum } from './shared';

const rankSite = (bySite) => bySite.map((s) => ({ label: s.name, scope1: s.scope1, scope2: s.scope2 }));

function ScopeParts({ totals }) {
  const parts = ['SCOPE_1', 'SCOPE_2', 'SCOPE_3'].map((k) => ({ key: k, label: SCOPE_LABEL[k], value: totals[k] || 0, color: SCOPE_COLOR[k] })).filter((p) => p.value > 0);
  return parts.length ? <Donut parts={parts} unit="tCO₂e" /> : <Empty />;
}

function Aging({ wf }) {
  const a = wf?.aging || {};
  const parts = [{ key: 'lt2', label: 'Under 2 days', color: '#0B4A3B' }, { key: 'd2to7', label: '2 to 7 days', color: '#1E9E78' }, { key: 'd7to14', label: '1 to 2 weeks', color: '#8ED1B6' }, { key: 'gt14', label: 'Over 2 weeks', color: '#D9A23A' }].map((p) => ({ ...p, value: a[p.key] || 0 }));
  return parts.some((p) => p.value > 0) ? <SplitBar parts={parts} unit="records" /> : <Empty title="Nothing is waiting" >Every record sent for review has been decided.</Empty>;
}

function TargetsPeek({ t, limit = 1 }) {
  const list = (t?.targets || []).filter((x) => x.baseValue > 0).slice(0, limit);
  if (!list.length) return <Empty title="No target yet">Set a reduction target to see the planned path against your actual figures.</Empty>;
  return (
    <div className="space-y-6">
      {list.map((x) => (
        <div key={x.id}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1"><div className="font-medium text-text text-sm">{x.name}</div><StatusBadge status={x.status} label={humanize(x.status)} /></div>
          {x.milestones.some((m) => m.actual != null) ? <TargetPath target={x} /> : (
            <p className="text-sm text-muted mt-1">Starts at {fmtNum(x.baseValue, 0)} tCO₂e in {x.baseYear} and aims for {fmtNum(x.targetValue, 0)} by {x.targetYear}. No year has been completed against it yet, so there is nothing to compare.</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function LeadDashboard() {
  const { data: e } = useApi('/analytics/emissions');
  const { data: wf } = useApi('/analytics/workflow');
  const { data: t } = useApi('/analytics/targets');
  if (!e) return <Skeleton />;
  const months = activeMonths(e.monthly);
  const spark = months.map((m) => m.total);
  const s1 = e.scopeTotals.SCOPE_1 || 0; const s2 = e.scopeTotals.SCOPE_2 || 0;
  const waiting = wf?.byStatus?.SUBMITTED || 0;
  const q = (x) => `/sustainability/explorer?${x}`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 -mt-[4.25rem] relative z-10">
        <Link to={q('status=APPROVED')} className="contents"><KpiTile icon={Gauge} label="Fuel and electricity emissions" value={fmtNum(s1 + s2, 0)} unit="tCO₂e" delta={monthDelta(months)} spark={spark} /></Link>
        <Link to={q('scope=SCOPE_1')} className="contents"><KpiTile icon={Flame} label="Fuel burned on site" value={fmtNum(s1, 0)} unit="tCO₂e" delta={monthDelta(months, 'scope1')} spark={months.map((m) => m.scope1)} /></Link>
        <Link to={q('scope=SCOPE_2')} className="contents"><KpiTile icon={Zap} label="Electricity bought" value={fmtNum(s2, 0)} unit="tCO₂e" delta={monthDelta(months, 'scope2')} spark={months.map((m) => m.scope2)} /></Link>
        <Link to="/sustainability/review" className="contents"><KpiTile icon={Hourglass} label="Waiting for review" value={fmtNum(waiting, 0)} unit="records" note={wf?.rejected ? `${fmtNum(wf.rejected, 0)} sent back for correction` : 'Select to open the review list'} /></Link>
      </div>
      <TodoPanel />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Emissions each month" description="Fuel and electricity, approved records only. The dashed line is the same month a year earlier.">
          {months.some((m) => m.total > 0) ? <ScopeTrend data={months} /> : <Empty />}
          <MonthTable months={months} />
        </Panel>
        <Panel title="Where it comes from" description="Share of all approved emissions by scope.">
          <ScopeParts totals={e.scopeTotals} />
          <div className="mt-5 border-t border-line pt-4"><div className="text-sm font-medium text-text mb-2">Biggest sources</div>
            <ShareBars rows={e.bySource.slice(0, 6).map((r, i) => ({ key: i, label: sourceLabel(r), value: r.tco2e }))} /></div>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Sites with the most emissions">
          {e.bySite.some((s) => s.scope1 + s.scope2 > 0) ? <>{e.bySite.length > 3 && <RankBars stacked rows={rankSite(e.bySite)} />}<SiteTable sites={e.bySite} /></> : <Empty title="Nothing to split yet">Sites show up once they have approved records.</Empty>}
        </Panel>
        <Panel title="Progress to your target"><TargetsPeek t={t} /></Panel>
      </div>
      <Panel title="Oldest records waiting or sent back" description="The ones that have waited longest come first."><WaitingTable wf={wf} role="lead" /></Panel>
    </div>
  );
}

export function ExecutiveDashboard() {
  const { data: e } = useApi('/analytics/emissions');
  const { data: wf } = useApi('/analytics/workflow');
  const { data: t } = useApi('/analytics/targets');
  const { data: a } = useApi('/analytics/assurance');
  if (!e) return <Skeleton />;
  const months = activeMonths(e.monthly);
  const last12 = e.monthly.filter((m) => m.total > 0).slice(-12);
  const prev12 = e.monthly.filter((m) => m.total > 0).slice(-24, -12);
  const yoy = prev12.length >= 6 && sum(prev12, 'total') > 0 ? ((sum(last12, 'total') - sum(prev12, 'total')) / sum(prev12, 'total')) * 100 : null;
  const spendLakh = sum(last12, 'costInr') / 100000;
  const intensity = spendLakh > 0 ? sum(last12, 'total') / spendLakh : null;
  const targets = t?.targets || [];
  const onTrack = targets.filter((x) => ['ON_TRACK', 'ACHIEVED'].includes(x.status)).length;
  const sev = (a?.verification || []).filter((r) => !['RESOLVED'].includes(r.status)).reduce((s, r) => s + r.count, 0);
  const actions = t?.actionsByStatus || {};
  const exp = sum(Object.values(actions), 'expectedTco2e'); const ach = sum(Object.values(actions), 'achievedTco2e');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 -mt-[4.25rem] relative z-10">
        <KpiTile icon={Gauge} label="Emissions, last 12 months" value={fmtNum(sum(last12, 'total'), 0)} unit="tCO₂e" delta={yoy} spark={months.map((m) => m.total)} note={yoy == null ? undefined : 'Delta shown is against the 12 months before'} />
        <KpiTile icon={TrendingDown} label="Emissions per ₹ lakh spent" value={intensity == null ? '—' : fmtNum(intensity, 3)} unit="tCO₂e" note="Lower means a cleaner rupee" />
        <KpiTile icon={TargetIcon} label="Targets on track" value={`${onTrack} of ${targets.length}`} note={targets.length ? undefined : 'No target set yet'} />
        <KpiTile icon={ShieldCheck} label="Open verifier questions" value={fmtNum(sev, 0)} note={sev ? 'Waiting for an answer or a decision' : 'Nothing open'} />
      </div>
      <TodoPanel />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Emissions each month" description="Approved records. Dashed line: same month last year.">
          {months.some((m) => m.total > 0) ? <ScopeTrend data={months} /> : <Empty />}
          <MonthTable months={months} />
        </Panel>
        <Panel title="Split by scope">
          <ScopeParts totals={e.scopeTotals} />
          <div className="mt-5 border-t border-line pt-4"><div className="text-sm font-medium text-text mb-2">Biggest sources</div>
            <ShareBars rows={e.bySource.slice(0, 6).map((r, i) => ({ key: i, label: sourceLabel(r), value: r.tco2e }))} /></div>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Target path" description="Straight line from the base year to the goal, with the actual figures on it."><TargetsPeek t={t} limit={1} /></Panel>
        <Panel title="Sites with the most emissions">{e.bySite.some((s) => s.scope1 + s.scope2 > 0) ? <>{e.bySite.length > 3 && <RankBars stacked rows={rankSite(e.bySite.slice(0, 8))} />}<SiteTable sites={e.bySite} /></> : <Empty />}</Panel>
      </div>
      <Panel title="Open verifier questions" description="Questions raised by the verifier that still need an answer or a decision."><QuestionsTable rows={a?.openQuestions} /></Panel>
    </div>
  );
}

export function PlantDashboard() {
  const { data: wf } = useApi('/analytics/workflow');
  const { data: e } = useApi('/analytics/emissions');
  if (!wf || !e) return <Skeleton />;
  const bs = wf.byStatus || {};
  const months = activeMonths(e.monthly);
  const sites = wf.perSite || [];
  const todo = sum(sites, 'sources') - sum(sites, 'done');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 -mt-[4.25rem] relative z-10">
        <KpiTile icon={Hourglass} label="Still to enter this month" value={fmtNum(Math.max(todo, 0), 0)} unit="meters and sources" note={todo > 0 ? 'Open Energy and fuel to add them' : 'Everything is in'} />
        <KpiTile icon={Flame} label="Saved, not sent for review" value={fmtNum(bs.DRAFT || 0, 0)} unit="records" />
        <KpiTile icon={ShieldCheck} label="Approved" value={fmtNum(bs.APPROVED || 0, 0)} unit="records" />
        <KpiTile icon={Gauge} label="Sent back to you" value={fmtNum(wf.rejected || 0, 0)} unit="records" note={wf.rejected ? 'Correct them and send again' : 'Nothing to fix'} />
      </div>
      <TodoPanel />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Your sites this month" description="Meters and sources with a record sent or approved, out of all that are active.">
          {sites.length ? <div className="space-y-4">{sites.map((s) => <Meter key={s.id} label={s.name} used={s.done} max={s.sources} warnAt={2} note={s.sources - s.done > 0 ? `${s.sources - s.done} still to enter` : 'Complete'} />)}</div> : <Empty title="No sites assigned">Ask your administrator to assign you to a site.</Empty>}
        </Panel>
        <Panel title="Where your records are"><SplitBar single parts={['APPROVED', 'SUBMITTED', 'DRAFT', 'REJECTED'].map((k) => ({ key: k, label: STATUS_LABEL[k], value: bs[k] || 0, color: STATUS_COLOR[k] }))} unit="records" /></Panel>
      </div>
      <Panel title="Waiting or sent back" description="Sent-back records come first. Correct them and send again."><WaitingTable wf={wf} role="plant" /></Panel>
    </div>
  );
}

export function FinanceDashboard() {
  const { data: e } = useApi('/analytics/emissions');
  const { data: f } = useApi('/analytics/finance');
  if (!e || !f) return <Skeleton />;
  const months = activeMonths(e.monthly).map((m) => ({ ...m, spendLakh: Math.round(m.costInr / 100000 * 100) / 100 }));
  const totalSpend = sum(e.monthly, 'costInr'); const totalT = sum(e.monthly, 'total');
  const remaining = sum(f.instruments, 'remainingMwh'); const total = sum(f.instruments, 'totalMwh');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 -mt-[4.25rem] relative z-10">
        <KpiTile icon={Wallet} label="Spent on fuel and power" value={fmtInr(totalSpend)} delta={monthDelta(months, 'costInr')} spark={months.map((m) => m.costInr)} />
        <KpiTile icon={Gauge} label="Cost of each tonne" value={totalT > 0 ? fmtInr(totalSpend / totalT) : '—'} unit="per tCO₂e" note="Rupees spent for each tonne of CO₂e released" />
        <KpiTile icon={Zap} label="Green power left to claim" value={fmtNum(remaining, 0)} unit="MWh" note={total ? `of ${fmtNum(total, 0)} MWh bought` : 'No certificates yet'} />
        <KpiTile icon={Hourglass} label="Certificates expiring in 60 days" value={fmtNum(sum(f.instruments, 'expiringSoon'), 0)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Spend each month" description="Fuel and electricity, ₹ lakh. Approved records only.">{months.some((m) => m.spendLakh > 0) ? <Columns stacked={false} data={months} series={[{ key: 'spendLakh', label: '₹ lakh spent', color: '#047857' }]} unit="₹ lakh" /> : <Empty />}
          <div className="mt-4 border-t border-line pt-3"><MiniTable rows={[...months].filter((m) => m.costInr > 0).slice(-3).reverse()} cols={[{ h: 'Month', c: (r) => r.label }, { h: 'Spent', right: true, c: (r) => fmtInr(r.costInr) }, { h: 'tCO₂e', right: true, c: (r) => fmtNum(r.total, 1) }, { h: '₹ per tonne', right: true, c: (r) => (r.total > 0 ? fmtInr(r.costInr / r.total) : '—') }]} /></div></Panel>
        <Panel title="Green power certificates" description="Balance left on each kind.">{f.instruments.length ? <div className="space-y-4">{f.instruments.map((i) => <Meter key={i.type} label={`${String(i.type).replace(/_/g, '-')} (${i.count})`} used={i.totalMwh - i.remainingMwh} max={i.totalMwh} note={`${fmtNum(i.remainingMwh, 0)} MWh left`} warnAt={0.95} />)}</div> : <Empty title="No certificates yet">Add a certificate under Green power certificates.</Empty>}</Panel>
      </div>
      <Panel title="Latest invoices"><MiniTable rows={f.recentInvoices} empty={<Empty title="No invoices yet" />} cols={[
        { h: 'Invoice', c: (r) => <><div className="font-medium">{r.number}</div><div className="text-xs text-muted">{r.plan}</div></> },
        { h: 'Issued', c: (r) => fmtDate(r.issuedAt) }, { h: 'Due', c: (r) => (r.dueAt ? fmtDate(r.dueAt) : '—') },
        { h: 'State', c: (r) => <StatusBadge status={r.status} label={humanize(r.status)} /> }, { h: 'Amount', right: true, c: (r) => fmtInr(r.totalInr) }]}
        more={<Link className="text-link underline" to="/finance/billing">See all invoices</Link>} /></Panel>
    </div>
  );
}

function WaitingTable({ wf, role }) {
  const to = role === 'plant' ? '/plant/fuels-energy' : '/sustainability/review';
  return (
    <MiniTable rows={wf?.waiting} empty={<Empty title="Nothing waiting">Records sent for review, and records sent back, show up here.</Empty>}
      cols={[
        { h: 'Record', c: (r) => <><div className="font-medium">{r.source}</div><div className="text-xs text-muted">{r.site} · {r.period}</div></> },
        { h: 'State', c: (r) => <StatusBadge status={r.status} label={STATUS_LABEL[r.status]} /> },
        { h: 'Entered by', c: (r) => r.by || '—' },
        { h: 'Since', c: (r) => fmtDate(r.at) },
        { h: 'tCO₂e', right: true, c: (r) => fmtNum(r.tco2e) }
      ]}
      more={<Link className="text-link underline" to={to}>{role === 'plant' ? 'Open energy and fuel' : 'Open the review list'}</Link>} />
  );
}

export function QuestionsTable({ rows }) {
  const sev = { CLARIFICATION: 'Clarification', MATERIAL_MISSTATEMENT: 'Material misstatement', NONCONFORMITY: 'Non-conformity' };
  return (
    <MiniTable rows={rows} empty={<Empty title="Nothing open">No verifier questions are waiting.</Empty>} cols={[
      { h: 'Question', c: (r) => <span className="line-clamp-2">{r.text}</span> }, { h: 'Seriousness', c: (r) => sev[r.severity] || humanize(r.severity) },
      { h: 'State', c: (r) => <StatusBadge status={r.status} label={humanize(r.status)} /> }, { h: 'Raised', c: (r) => fmtDate(r.createdAt) }]}
      more={<Link className="text-link underline" to="/verifier/room">Open the verification room</Link>} />
  );
}
