import React, { useMemo } from 'react';
import { Lock } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, Notice, PageHeader, StatusBadge } from '../../components/ui';
import { fmtDate } from '../../utils/formatters';
import { PERIOD_STATUS } from '../../utils/labels';

export default function ExecutiveSignOffPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const dialog = useDialog();
  const { data: periods, refetch: refP } = useApi('/periods');
  const { data: imps, refetch: refI } = useApi('/imp');
  const isExec = user?.roles?.includes('EXECUTIVE_APPROVER');
  const canWrite = user?.roles?.some((r) => ['SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER'].includes(r));
  const years = useMemo(() => {
    const m = new Map();
    (periods || []).forEach((p) => { const y = m.get(p.financialYear) || { fy: p.financialYear, list: [] }; y.list.push(p); m.set(p.financialYear, y); });
    return [...m.values()].sort((a, b) => b.fy.localeCompare(a.fy));
  }, [periods]);

  async function signOff(p) {
    if (!(await dialog.confirm({ title: `Sign off ${p.label}?`, message: 'You confirm these figures are correct. The evidence for this month is locked and can no longer be changed.', confirmLabel: 'Sign off' }))) return;
    try { await apiFetch(`/periods/${p.id}/sign-off`, { method: 'POST' }); pushToast('Signed off. Evidence is locked.'); refP(); } catch (e) { pushToast(e.message, 'error'); }
  }
  async function reopen(p) {
    const v = await dialog.form({ title: `Reopen ${p.label}`, description: 'Reopening lets the team correct the month. Auditors are told it changed.', submitLabel: 'Reopen', danger: true, fields: [{ name: 'reason', type: 'textarea', label: 'Why is it being reopened?', required: true, minLength: 10 }] });
    if (!v) return;
    try { await apiFetch(`/periods/${p.id}/reopen`, { method: 'POST', body: JSON.stringify({ reason: v.reason }) }); pushToast('Reopened.'); refP(); } catch (e) { pushToast(e.message, 'error'); }
  }
  async function writeImp() {
    const v = await dialog.form({ title: 'Write the inventory plan', description: 'A short plan that tells auditors how your figures are put together. An executive approves it.', submitLabel: 'Send for approval', wide: true, fields: [
      { name: 'financialYear', type: 'select', label: 'Financial year', required: true, options: years.map((y) => ({ value: y.fy, label: y.fy })) },
      { name: 'consolidationNarrative', type: 'textarea', label: 'What is included?', required: true, minLength: 20, placeholder: 'Which companies and sites are counted, and why.' },
      { name: 'methodologyNarrative', type: 'textarea', label: 'How are figures calculated?', required: true, minLength: 20, placeholder: 'Sources of factors, conversion rules, standards followed.' },
      { name: 'qaQcProcedures', type: 'textarea', label: 'How is data checked?', required: true, minLength: 20, placeholder: 'Who reviews, how often, what is compared.' },
      { name: 'exclusionPolicy', type: 'textarea', label: 'What is left out and why?', required: true, minLength: 20, placeholder: 'Anything not counted, with the reason.' }] });
    if (!v) return;
    try { await apiFetch('/imp', { method: 'POST', body: JSON.stringify(v) }); pushToast('Plan sent for approval.'); refI(); } catch (e) { pushToast(e.message, 'error'); }
  }
  async function approveImp(i) {
    if (!(await dialog.confirm({ title: `Approve the ${i.financialYear} plan?`, message: 'Auditors will read this plan together with your figures.', confirmLabel: 'Approve' }))) return;
    try { await apiFetch(`/imp/${i.id}/approve`, { method: 'PATCH' }); pushToast('Plan approved.'); refI(); } catch (e) { pushToast(e.message, 'error'); }
  }

  const waiting = (periods || []).filter((p) => p.status === 'CLOSED').length;
  return (
    <div>
      <PageHeader title="Sign off the year" description="Confirm closed months and approve the plan that explains how your figures are made." />
      {waiting > 0 && <Notice tone="info" className="mb-4"><strong>{waiting} closed {waiting === 1 ? 'month is' : 'months are'} waiting for your sign-off.</strong></Notice>}
      <div className="space-y-4">
        {!periods ? <div className="h-32 animate-pulse" /> : years.length === 0 ? <Card><EmptyState title="No months yet">Months appear here once they are opened and closed.</EmptyState></Card> : years.map((y) => (
          <Card key={y.fy} title={y.fy} padded={false}>
            <ul className="divide-y divide-line">{y.list.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                <div className="flex-1 min-w-[10rem]"><span className="font-medium">{p.label}</span>{p.signedOffAt && <span className="text-sm text-muted"> · signed off {fmtDate(p.signedOffAt)}</span>}</div>
                <StatusBadge status={p.status} label={PERIOD_STATUS[p.status]} />
                {p.status === 'CLOSED' && isExec && <Button size="sm" onClick={() => signOff(p)}><Lock className="w-3.5 h-3.5" /> Sign off</Button>}
                {['CLOSED', 'SIGNED_OFF'].includes(p.status) && canWrite && (p.status === 'CLOSED' || isExec) && <Button size="sm" variant="secondary" onClick={() => reopen(p)}>Reopen</Button>}
              </li>))}</ul>
          </Card>))}
        <Card title="Inventory plan" description="How your figures are put together. Auditors read this first." actions={canWrite && <Button size="sm" variant="secondary" onClick={writeImp}>Write a plan</Button>} padded={false}>
          {!imps ? <div className="h-16 animate-pulse" /> : imps.length === 0 ? <EmptyState title="No plan yet">Write one so auditors know how your figures are produced.</EmptyState> : (
            <ul className="divide-y divide-line">{imps.map((i) => <li key={i.id} className="flex flex-wrap items-start gap-3 px-5 py-3"><div className="flex-1 min-w-[14rem]"><div className="font-medium">{i.financialYear} · version {i.version}</div><div className="text-sm text-muted line-clamp-2">{i.consolidationNarrative}</div></div><StatusBadge status={i.status} label={i.status === 'PENDING' ? 'Waiting for approval' : 'Approved'} />{i.status === 'PENDING' && isExec && <Button size="sm" onClick={() => approveImp(i)}>Approve</Button>}</li>)}</ul>)}
        </Card>
      </div>
    </div>
  );
}
