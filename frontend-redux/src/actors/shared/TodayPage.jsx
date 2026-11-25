import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, CircleAlert, Clock, FileSearch, Flame, Zap, Gauge, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { Card, EmptyState, PageHeader } from '../../components/ui';
import { MonthlyBars, ShareBars } from '../../components/charts/Charts';
import { fmtDate, fmtInr, fmtNum } from '../../utils/formatters';

const dot = { warn: 'bg-saffron-600', danger: 'bg-danger-600', ok: 'bg-ok-600', info: 'bg-brand-500' };

function Tile({ icon: Icon, label, value, unit, note, to }) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-sm text-muted"><Icon className="w-4 h-4 text-brand-500" strokeWidth={1.75} />{label}</div>
      <div className="mt-2 text-[1.5rem] sm:text-[1.75rem] leading-none font-semibold tabular-nums text-text break-words">{value}{unit && <span className="ml-1.5 text-sm font-normal text-muted">{unit}</span>}</div>
      {note && <div className="mt-2 text-xs text-muted">{note}</div>}
    </>
  );
  return to
    ? <Link to={to} className="card px-4 py-3.5 block hover:border-brand-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{body}</Link>
    : <div className="card px-4 py-3.5">{body}</div>;
}

/** The first screen after sign-in: what to do now, then the numbers. Same screen for plant managers, leads and executives. */
export default function TodayPage() {
  const { user } = useAuth();
  const roles = user?.roles || [];
  const isPlantOnly = roles.length > 0 && roles.every((r) => r === 'PLANT_MANAGER');
  const canReview = roles.some((r) => ['SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER'].includes(r));
  const { data: d, loading } = useApi('/dashboard');
  const { data: periods } = useApi('/periods');

  const period = useMemo(() => (periods || [])
    .filter((p) => ['OPEN', 'REOPENED'].includes(p.status) && new Date(p.startDate) <= new Date())
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))[0], [periods]);
  const { data: outstanding } = useApi(period ? `/periods/${period.id}/outstanding` : null);
  const { data: readiness } = useApi(period && canReview ? `/periods/${period.id}/readiness` : null);
  const { data: sentBack } = useApi('/entries?page=1&pageSize=1&status=REJECTED');
  const { data: drafts } = useApi(period ? `/entries?page=1&pageSize=1&status=DRAFT&periodId=${period.id}` : null);

  const first = (user?.fullName || '').split(' ')[0];
  const tasks = [];
  if (period && outstanding?.count > 0) tasks.push({ tone: outstanding.overdue ? 'danger' : 'warn', text: `${fmtNum(outstanding.count, 0)} ${outstanding.count === 1 ? 'meter or source has' : 'meters and sources have'} no data for ${period.label}${outstanding.overdue ? ` (it was due ${fmtDate(outstanding.dueAt)})` : ` (due ${fmtDate(outstanding.dueAt)})`}.`, to: isPlantOnly ? '/plant/fuels-energy' : '/sustainability/this-month', cta: 'See what is missing' });
  if (sentBack?.total > 0) tasks.unshift({ tone: 'danger', text: `${fmtNum(sentBack.total, 0)} ${sentBack.total === 1 ? 'record was' : 'records were'} sent back to you. Correct ${sentBack.total === 1 ? 'it' : 'them'} and send again.`, to: '/plant/fuels-energy', cta: 'Fix and send again' });
  if (drafts?.total > 0) tasks.push({ tone: 'info', text: `${fmtNum(drafts.total, 0)} ${drafts.total === 1 ? 'record is' : 'records are'} saved but not yet sent for review.`, to: '/plant/fuels-energy', cta: 'Send for review' });
  if (canReview && d?.kpis?.pendingApprovals > 0) tasks.push({ tone: 'warn', text: `${fmtNum(d.kpis.pendingApprovals, 0)} ${d.kpis.pendingApprovals === 1 ? 'record is' : 'records are'} waiting for your review.`, to: '/sustainability/review', cta: 'Review now' });
  if (canReview && readiness?.readyToClose) tasks.push({ tone: 'ok', text: `${period.label} has everything it needs and can be closed.`, to: '/sustainability/close', cta: 'Close the month' });
  if (d?.kpis?.flaggedAnomalies > 0) tasks.push({ tone: 'warn', text: `${d.kpis.flaggedAnomalies} approved ${d.kpis.flaggedAnomalies === 1 ? 'record was' : 'records were'} flagged by the automatic checks (unusual size or repeated bill).`, to: '/sustainability/explorer?status=APPROVED', cta: 'Look at them' });

  if (loading || !d) return <div className="space-y-4"><div className="card h-40 animate-pulse" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="card h-28 animate-pulse" />)}</div></div>;

  const k = d.kpis;
  const hasData = d.monthlyTrend.some((m) => m.scope1 + m.scope2 > 0);
  const trend = d.monthlyTrend.filter((m) => m.scope1 + m.scope2 > 0 || m.periodId === period?.id).slice(-12).map((m) => ({ label: m.label.replace(/\s\d{4}$/, (y) => `’${y.trim().slice(2)}`), scope1: m.scope1, scope2: m.scope2 }));
  const explorer = (q) => `/sustainability/explorer?${q}`;

  return (
    <div>
      <PageHeader title={`${first ? `Hello, ${first}` : 'Hello'}`} description={period ? `You are working on ${period.label}.` : 'There is no open month right now.'} />

      <Card className="mb-4" title="What needs doing" padded={false}>
        {tasks.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-4 text-sm"><CheckCircle2 className="w-5 h-5 text-ok-600" /><span className="text-text">You are up to date{period ? ` for ${period.label}` : ''}. Nothing is waiting for you.</span></div>
        ) : (
          <ul className="divide-y divide-line">
            {tasks.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className={`w-2 h-2 rounded-full ${dot[t.tone]} shrink-0`} aria-hidden />
                <span className="flex-1 min-w-[14rem] text-sm text-text">{t.text}</span>
                <Link to={t.to} className="btn btn-secondary !min-h-9 text-sm">{t.cta} <ArrowRight className="w-4 h-4" /></Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Tile icon={Gauge} label="Emissions from fuel and electricity" value={fmtNum(k.totalScope1And2Tco2e)} unit="tCO₂e" note="Approved records only. Select to explore." to={explorer('status=APPROVED')} />
        <Tile icon={Flame} label="Fuel burned on site" value={fmtNum(k.totalScope1Tco2e)} unit="tCO₂e" note="Direct emissions (Scope 1)" to={explorer('scope=SCOPE_1')} />
        <Tile icon={Zap} label="Electricity bought" value={fmtNum(k.totalScope2Tco2e)} unit="tCO₂e" note="Indirect emissions (Scope 2)" to={explorer('scope=SCOPE_2')} />
        <Tile icon={Wallet} label="Spent on energy and fuel" value={fmtInr(k.totalSpendInr)} note={`${fmtNum(k.totalEnergyGj, 0)} GJ of energy`} to={explorer('groupBy=source')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="Emissions each month" description="Only approved records are counted, so these numbers match your month-end close.">
          {hasData ? <MonthlyBars data={trend} series={[{ key: 'scope1', label: 'Fuel burned on site' }, { key: 'scope2', label: 'Electricity bought' }]} />
            : <EmptyState icon={FileSearch} title="No approved data yet" action={<Link to="/plant/fuels-energy" className="btn btn-primary">Enter this month’s data</Link>}>Numbers appear here once the first records are approved.</EmptyState>}
        </Card>
        <Card title="By site" description={d.facilityBreakdown.length > 1 ? 'Where the emissions come from.' : undefined}>
          {d.facilityBreakdown.some((f) => f.tco2e > 0)
            ? <ShareBars rows={d.facilityBreakdown.filter((f) => f.tco2e > 0).sort((a, b) => b.tco2e - a.tco2e).map((f) => ({ key: f.id, label: f.name, value: f.tco2e, sub: `${f.city}, ${f.state} · ${fmtInr(f.costInr)}` }))} />
            : <EmptyState icon={FileSearch} title="Nothing to split yet">Sites show up once they have approved records.</EmptyState>}
        </Card>
      </div>
    </div>
  );
}
