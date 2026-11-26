import React from 'react';
import { Activity, ClipboardCheck, CalendarClock, Hourglass, KeyRound, ShieldCheck, Users, Building2, Wallet, Globe, Receipt, TrendingUp } from 'lucide-react';
import { useApi } from '../../../hooks/useApi';
import { Columns, Donut, HeatDays, KpiTile, Lines, Meter, RankBars, Rings, SplitBar } from '../../../components/charts/Analytics';
import { StatusBadge, humanize } from '../../../components/ui';
import { fmtDate, fmtInr, fmtInrShort, fmtNum } from '../../../utils/formatters';
import { Link } from 'react-router-dom';
import { QuestionsTable } from './EmissionsDashboards';
import { Empty, MiniTable, Panel, Skeleton, sum } from './shared';

const SEV = { CLARIFICATION: 'Clarification', MATERIAL_MISSTATEMENT: 'Material misstatement', NONCONFORMITY: 'Non-conformity' };
const FIND = { OPEN: '#D9A23A', RESPONDED: '#1E9E78', RESOLVED: '#0B4A3B', UNRESOLVED: '#8ED1B6' };
const FIND_LABEL = { OPEN: 'Open', RESPONDED: 'Answered', RESOLVED: 'Resolved', UNRESOLVED: 'Unresolved' };
const INTERNAL = { PASS: ['Pass', '#0B4A3B'], DEFICIENCY: ['Deficiency', '#8ED1B6'], REMEDIATION_REQUIRED: ['Fix required', '#D9A23A'], CLOSED: ['Closed', '#7FA392'] };
const ENG = { CREATED: ['Not started', '#BFDCCD'], IN_PROGRESS: ['In progress', '#1E9E78'], OPINION_ISSUED: ['Opinion issued', '#0B4A3B'], CANCELLED: ['Cancelled', '#7FA392'] };

function FindingsBySeverity({ rows }) {
  const data = Object.keys(SEV).map((s) => ({ label: SEV[s], ...Object.fromEntries(Object.keys(FIND).map((st) => [st, rows.filter((r) => r.severity === s && r.status === st).reduce((a, r) => a + r.count, 0)])) }));
  return data.some((d) => Object.keys(FIND).some((k) => d[k] > 0))
    ? <Columns data={data} series={Object.keys(FIND).map((k) => ({ key: k, label: FIND_LABEL[k], color: FIND[k] }))} height={240} />
    : <Empty title="No findings yet">Findings appear when a verifier raises a question.</Empty>;
}

export function AuditorDashboard() {
  const { data: a } = useApi('/analytics/assurance');
  if (!a) return <Skeleton />;
  const open = (a.verification || []).filter((r) => r.status !== 'RESOLVED').reduce((s, r) => s + r.count, 0);
  const internalOpen = (a.internal.DEFICIENCY || 0) + (a.internal.REMEDIATION_REQUIRED || 0);
  const total30 = sum(a.activity, 'count');
  const days = a.activity.length ? a.activity : [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 -mt-[4.25rem] relative z-10">
        <KpiTile icon={ClipboardCheck} label="Internal findings needing action" value={fmtNum(internalOpen, 0)} note={internalOpen ? 'Deficiency or fix required' : 'All clear'} />
        <KpiTile icon={ShieldCheck} label="Open verifier questions" value={fmtNum(open, 0)} />
        <KpiTile icon={Activity} label="Actions logged, last 30 days" value={fmtNum(total30, 0)} spark={days.map((d) => d.count)} />
        <KpiTile icon={CalendarClock} label="Assurance engagements" value={fmtNum(sum(Object.values(a.engagements).map((n) => ({ n })), 'n'), 0)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Activity in the system" description="Everything recorded in the activity log, by day.">{total30 ? <HeatDays days={days} unit="actions" /> : <Empty title="Nothing logged lately">Actions people take are recorded here as they happen.</Empty>}</Panel>
        <Panel title="Internal findings by state">{Object.keys(a.internal).length ? <Donut unit="findings" parts={Object.entries(a.internal).map(([k, v]) => ({ key: k, label: INTERNAL[k]?.[0] || humanize(k), value: v, color: INTERNAL[k]?.[1] || '#7FA392' }))} /> : <Empty title="No internal findings yet" />}</Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Verifier findings" description="By how serious, coloured by where each one stands."><FindingsBySeverity rows={a.verification} /></Panel>
        <Panel title="Latest internal findings"><MiniTable rows={a.recentInternal} empty={<Empty title="No internal findings yet" />} cols={[
          { h: 'Area', c: (r) => humanize(r.domain) }, { h: 'Finding', c: (r) => <span className="line-clamp-2">{r.summary}</span> },
          { h: 'State', c: (r) => <StatusBadge status={r.status} label={INTERNAL[r.status]?.[0] || humanize(r.status)} /> }]}
          more={<Link className="text-link underline" to="/internal-audit/findings">Open audit findings</Link>} /></Panel>
        <Panel title="Open verifier questions"><QuestionsTable rows={a.openQuestions} /></Panel>
      </div>
    </div>
  );
}

export function VerifierDashboard() {
  const { data: a } = useApi('/analytics/assurance');
  if (!a) return <Skeleton />;
  const rows = a.verification || [];
  const count = (st) => rows.filter((r) => r.status === st).reduce((s, r) => s + r.count, 0);
  const total = sum(rows, 'count');
  const resolved = count('RESOLVED');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 -mt-[4.25rem] relative z-10">
        <KpiTile icon={ShieldCheck} label="Questions raised" value={fmtNum(total, 0)} />
        <KpiTile icon={Hourglass} label="Waiting for the company" value={fmtNum(count('OPEN'), 0)} />
        <KpiTile icon={ClipboardCheck} label="Answered, needs your decision" value={fmtNum(count('RESPONDED'), 0)} />
        <KpiTile icon={Activity} label="Resolved" value={total ? `${Math.round((resolved / total) * 100)}%` : '—'} note={total ? `${resolved} of ${total}` : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Findings by seriousness"><FindingsBySeverity rows={rows} /></Panel>
      </div>
      <Panel title="Questions waiting"><QuestionsTable rows={a.openQuestions} /></Panel>
    </div>
  );
}

export function AdminDashboard() {
  const { data: d } = useApi('/analytics/admin');
  if (!d) return <Skeleton />;
  const login14 = sum(d.logins, 'count');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 -mt-[4.25rem] relative z-10">
        <KpiTile icon={Users} label="People with access" value={fmtNum(d.users.active, 0)} note={d.users.pendingInvites ? `${d.users.pendingInvites} invitation${d.users.pendingInvites === 1 ? '' : 's'} not accepted yet` : undefined} />
        <KpiTile icon={Building2} label="Sites" value={fmtNum(d.sites.used, 0)} />
        <KpiTile icon={KeyRound} label="Two-step sign-in on" value={d.twoFactor.total ? `${Math.round((d.twoFactor.enabled / d.twoFactor.total) * 100)}%` : '—'} note={`${d.twoFactor.enabled} of ${d.twoFactor.total} people`} />
        <KpiTile icon={Activity} label="Sign-ins, last 14 days" value={fmtNum(login14, 0)} spark={d.logins.map((l) => l.count)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Your plan: ${d.plan.name}`} description="How much of the plan you use."><Rings items={[{ label: 'People', used: d.users.active + d.users.pendingInvites, max: d.users.max, note: 'Includes invitations not yet accepted' }, { label: 'Sites', used: d.sites.used, max: d.sites.max }]} /></Panel>
        <Panel title="Recently active people"><MiniTable rows={d.recentPeople} cols={[{ h: 'Person', c: (r) => <><div className="font-medium">{r.name}</div><div className="text-xs text-muted">{r.email}</div></> }, { h: 'Last signed in', c: (r) => (r.lastLoginAt ? fmtDate(r.lastLoginAt) : 'Never') }, { h: 'Two-step', c: (r) => (r.twoFactor ? 'On' : 'Off') }]} more={<Link className="text-link underline" to="/admin/team">Manage team and access</Link>} /></Panel>
        <Panel title="Invitations not accepted yet"><MiniTable rows={d.pendingInvites} empty={<Empty title="No pending invitations" />} cols={[{ h: 'Email', c: (r) => r.email }, { h: 'Roles', c: (r) => r.roles.map(humanize).join(', ') }, { h: 'Expires', c: (r) => fmtDate(r.expiresAt) }]} /></Panel>
      </div>
    </div>
  );
}

function CompaniesTable() {
  const { data } = useApi('/platform/organizations?pageSize=8');
  const rows = Array.isArray(data) ? data : data?.items || data?.rows || [];
  return (
    <MiniTable rows={rows} empty={<Empty title="No companies yet" />} cols={[
      { h: 'Company', c: (r) => <Link className="font-medium hover:underline" to={`/platform/organizations/${r.id}`}>{r.name}</Link> },
      { h: 'Plan', c: (r) => r.plan?.name || '—' },
      { h: 'State', c: (r) => humanize(r.status) },
      { h: 'People', right: true, c: (r) => r._count?.users ?? '—' },
      { h: 'Sites', right: true, c: (r) => r._count?.facilities ?? '—' },
      { h: 'Joined', right: true, c: (r) => fmtDate(r.createdAt) },
    ]} />
  );
}

export function PlatformDashboard() {
  const { data: d } = useApi('/platform/analytics');
  const { data: sm } = useApi('/platform/summary');
  if (!d) return <Skeleton />;
  const status = { ACTIVE: ['Paying', '#0B4A3B'], TRIAL: ['On trial', '#1E9E78'], PAST_DUE: ['Payment late', '#8ED1B6'], SUSPENDED: ['Suspended', '#D9A23A'], CLOSED: ['Closed', '#7FA392'] };
  const totalOrgs = sum(Object.values(d.byStatus).map((n) => ({ n })), 'n');
  const records = sum(d.recordsPerMonth, 'n');
  const unpaid = sum(d.invoices, 'open');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 -mt-[4.25rem] relative z-10">
        <KpiTile icon={Globe} label="Companies" value={fmtNum(totalOrgs, 0)} note={`${d.byStatus.ACTIVE || 0} paying · ${d.byStatus.TRIAL || 0} on trial`} />
        <KpiTile icon={Wallet} label="Monthly recurring revenue" value={fmtInr(d.mrrInr)} note="Paying companies at list price, before GST" />
        <KpiTile icon={TrendingUp} label="Records entered, last 12 months" value={fmtNum(records, 0)} spark={d.recordsPerMonth.map((r) => r.n)} />
        <KpiTile icon={Receipt} label="Invoices not paid yet" value={fmtInr(unpaid)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Companies by state"><Donut unit="companies" parts={Object.entries(status).map(([k, [l, c]]) => ({ key: k, label: l, value: d.byStatus[k] || 0, color: c }))} /></Panel>
        <Panel title="Invoices by month" description="Paid and not yet paid, in rupees."><Columns data={d.invoices.map((r) => ({ label: r.label, paid: r.paid, open: r.open }))} series={[{ key: 'paid', label: 'Paid', color: '#0B4A3B' }, { key: 'open', label: 'Not paid yet', color: '#8ED1B6' }]} yFormat={fmtInrShort} /></Panel>
      </div>
      <Panel title="Companies" description="The newest companies and where each stands." actions={<Link to="/platform/organizations" className="text-sm underline">All companies</Link>}>
        <CompaniesTable />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Trials ending this week"><MiniTable rows={sm?.trialsEndingSoon} empty={<Empty title="No trials ending soon">Companies on a trial appear here in their last week.</Empty>} cols={[{ h: 'Company', c: (r) => <Link className="text-link underline" to={`/platform/organizations/${r.id}`}>{r.name}</Link> }, { h: 'Ends', c: (r) => fmtDate(r.trialEndsAt) }]} /></Panel>
        <Panel title="Waiting for a second administrator"><MiniTable rows={sm?.pendingApprovals} empty={<Empty title="Nothing waiting" />} cols={[{ h: 'Request', c: (r) => `Close ${r.organization?.name}` }, { h: 'Reason', c: (r) => r.reason }]} more={<Link className="text-link underline" to="/platform/overview">Decide on requests</Link>} /></Panel>
      </div>
    </div>
  );
}
