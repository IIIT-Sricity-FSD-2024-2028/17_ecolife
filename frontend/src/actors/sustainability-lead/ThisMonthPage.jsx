import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Circle, Mail } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { Button, Card, EmptyState, Notice, PageHeader, SelectField, StatusBadge } from '../../components/ui';
import { fmtDate } from '../../utils/formatters';

function Step({ done, title, detail, action, children }) {
  return (
    <li className="flex gap-3 px-5 py-4">
      <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-ok-600 text-white' : 'border-2 border-line-strong text-transparent'}`}>{done ? <Check className="w-4 h-4" /> : <Circle className="w-3 h-3" />}</span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-medium text-text">{title}</div>{action}</div>
        <p className="text-sm text-muted mt-0.5">{detail}</p>
        {children}
      </div>
    </li>
  );
}

/** The month at a glance: what is done, what is missing, and who has to do it. */
export default function ThisMonthPage() {
  const { pushToast } = useToast();
  const { data: periods } = useApi('/periods');
  const open = useMemo(() => (periods || []).filter((p) => ['OPEN', 'REOPENED'].includes(p.status) && new Date(p.startDate) <= new Date()).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate))), [periods]);
  const [pick, setPick] = useState('');
  const period = open.find((p) => p.id === pick) || open[0];
  const { data: r } = useApi(period ? `/periods/${period.id}/readiness` : null);
  const { data: o, refetch } = useApi(period ? `/periods/${period.id}/outstanding` : null);
  const [busy, setBusy] = useState(false);

  async function remind() {
    setBusy(true);
    try {
      const x = await apiFetch(`/periods/${period.id}/remind`, { method: 'POST' });
      pushToast(x.queued ? `Reminder sent to ${x.owners} ${x.owners === 1 ? 'person' : 'people'}.` : x.sourcesWithoutOwner ? `No one to remind: ${x.sourcesWithoutOwner} source(s) have no owner yet.` : 'Everyone was already reminded today.');
      refetch();
    } catch (e) { pushToast(e.message, 'error'); } finally { setBusy(false); }
  }

  if (periods && !period) return <><PageHeader title="This month" /><div className="card"><EmptyState title="No open month" action={<Link to="/sustainability/close" className="btn btn-primary">Open months</Link>}>All months that have started are closed. Open the next one to start collecting data.</EmptyState></div></>;
  if (!period || !r || !o) return <div className="card h-64 animate-pulse" />;

  const missing = o.count;
  const dataDone = missing === 0 && r.totalActiveSources > 0;
  return (
    <div>
      <PageHeader title="This month" description="Follow these steps in order. When every step is ticked, the month can be closed."
        actions={open.length > 1 ? <SelectField className="min-w-[10rem]" label="" aria-label="Month" value={period.id} onChange={setPick} options={open.map((p) => ({ value: p.id, label: p.label }))} /> : <StatusBadge status={period.status} label={period.label} />} />

      <div className="card p-5 mb-4 flex flex-wrap items-center gap-6">
        <div>
          <div className="text-sm text-muted">{period.label} is</div>
          <div className="text-[2rem] leading-none font-semibold tabular-nums mt-1">{r.readinessScorePct}%<span className="text-sm font-normal text-muted ml-2">ready to close</span></div>
        </div>
        <div className="flex-1 min-w-[12rem]"><div className="h-2.5 rounded-full bg-brand-50 overflow-hidden"><div className="h-full bg-brand-600 rounded-full" style={{ width: `${r.readinessScorePct}%` }} /></div>
          <div className="mt-2 text-sm text-muted">{r.totalEntries} {r.totalEntries === 1 ? 'record' : 'records'} from {r.totalActiveSources} {r.totalActiveSources === 1 ? 'meter or source' : 'meters and sources'}. Data is due {fmtDate(o.dueAt)}{o.overdue ? ' and is late' : ''}.</div></div>
        {r.readyToClose && <Link to="/sustainability/close" className="btn btn-primary">Close {period.label} <ArrowRight className="w-4 h-4" /></Link>}
      </div>

      <Card padded={false} title="Steps">
        <ul className="divide-y divide-line">
          <Step done={dataDone} title="All meters and sources have data" detail={missing ? `${missing} still ${missing === 1 ? 'has' : 'have'} nothing for ${period.label}.` : 'Every active meter and source has a record.'}
            action={missing > 0 && <Button size="sm" variant="secondary" loading={busy} onClick={remind}><Mail className="w-4 h-4" /> Email the owners</Button>}>
            {missing > 0 && <ul className="mt-3 text-sm divide-y divide-line border border-line rounded-md">{o.sources.slice(0, 10).map((s) => <li key={s.sourceId} className="px-3 py-2 flex flex-wrap justify-between gap-2"><span><span className="font-medium">{s.source}</span> <span className="text-muted">· {s.facility}</span></span><span className={s.owner ? 'text-muted' : 'text-saffron-600'}>{s.owner || 'No owner set. Assign one in Sites and factors.'}</span></li>)}{missing > 10 && <li className="px-3 py-2 text-muted">and {missing - 10} more</li>}</ul>}
          </Step>
          <Step done={r.unapprovedCount === 0 && r.totalEntries > 0} title="Every record is reviewed" detail={r.unapprovedCount ? `${r.unapprovedCount} ${r.unapprovedCount === 1 ? 'record is' : 'records are'} not approved yet.` : 'All records are approved.'} action={r.unapprovedCount > 0 && <Link to="/sustainability/review" className="btn btn-secondary btn-sm">Go to Review <ArrowRight className="w-4 h-4" /></Link>} />
          <Step done={r.missingMaterialEvidenceCount === 0} title="Big entries have a supporting document" detail={r.missingMaterialEvidenceCount ? `${r.missingMaterialEvidenceCount} large ${r.missingMaterialEvidenceCount === 1 ? 'entry has' : 'entries have'} no bill or certificate attached.` : 'Every large entry has a document attached.'} action={r.missingMaterialEvidenceCount > 0 && <Link to="/sustainability/documents" className="btn btn-secondary btn-sm">Add documents <ArrowRight className="w-4 h-4" /></Link>} />
          <Step done={r.flaggedAnomaliesCount === 0 && r.trueUpPendingCount === 0} title="Automatic checks are cleared" detail={r.flaggedAnomaliesCount || r.trueUpPendingCount ? [r.flaggedAnomaliesCount && `${r.flaggedAnomaliesCount} unusual ${r.flaggedAnomaliesCount === 1 ? 'amount needs' : 'amounts need'} an explanation`, r.trueUpPendingCount && `${r.trueUpPendingCount} estimated ${r.trueUpPendingCount === 1 ? 'figure is' : 'figures are'} waiting for the real bill`].filter(Boolean).join('. ') + '.' : 'Nothing unusual is waiting.'} />
        </ul>
      </Card>
      {r.warnings?.length > 0 && <Notice tone="warn" className="mt-4">{r.warnings.join(' ')}</Notice>}
    </div>
  );
}
