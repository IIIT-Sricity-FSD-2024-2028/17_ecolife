import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useApi } from '../../../hooks/useApi';
import { Card } from '../../../components/ui';
import { fmtDate, fmtNum } from '../../../utils/formatters';

const dot = { warn: 'bg-saffron-600', danger: 'bg-danger-600', ok: 'bg-ok-600', info: 'bg-brand-500' };

/** "What needs doing": the same short list as the To do page, so the dashboard has actions as well as charts. */
export default function TodoPanel() {
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

  return (
    <Card title="What needs doing" padded={false}>
      {tasks.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-4 text-sm"><CheckCircle2 className="w-5 h-5 text-ok-600" /><span className="text-text">You are up to date{period ? ` for ${period.label}` : ''}. Nothing is waiting.</span></div>
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
  );
}
