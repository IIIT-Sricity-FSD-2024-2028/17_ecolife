import React from 'react';
import { Plus } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useOptions, toOptions } from '../../hooks/useOptions';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, Notice, PageHeader, StatusBadge } from '../../components/ui';
import { fmtDate } from '../../utils/formatters';
import { RECALC_TRIGGER } from '../../utils/labels';

export default function RestatementsDecisionsPage() {
  const { user } = useAuth();
  const send = useAction();
  const dialog = useDialog();
  const { enums } = useOptions();
  const { data: rows, refetch } = useApi('/recalculations');
  const { data: periods } = useApi('/periods');
  const isExec = user?.roles?.includes('EXECUTIVE_APPROVER');
  const canAsk = user?.roles?.some((r) => ['SUSTAINABILITY_LEAD', 'FINANCE_MANAGER'].includes(r));
  const label = (id) => (periods || []).find((p) => p.id === id)?.label;

  async function ask() {
    const v = await dialog.form({ title: 'Ask to correct past figures', description: 'When something changes how a past year should read, an executive decides if those figures are restated.', submitLabel: 'Send for decision', wide: true, fields: [
      { name: 'triggerType', type: 'select', label: 'What changed?', required: true, options: toOptions(enums.RecalcTriggerType, RECALC_TRIGGER) },
      { name: 'periodId', type: 'select', label: 'Which month is affected?', required: true, options: (periods || []).filter((p) => ['CLOSED', 'SIGNED_OFF'].includes(p.status)).map((p) => ({ value: p.id, label: p.label })), hint: 'Ask again for other months.' },
      { name: 'impact', type: 'number', label: 'Expected change in your total', required: true, unit: '%', hint: 'Use a minus sign for a fall.' },
      { name: 'reason', type: 'textarea', label: 'Explain what happened', required: true, minLength: 20 }] });
    if (!v) return;
    await send({ path: '/recalculations', method: 'POST', body: { triggerType: v.triggerType, affectedPeriodIds: [v.periodId], estimatedImpactPct: Number(v.impact), reason: v.reason.trim() }, toast: 'Sent for decision.' });
  }
  async function decide(r, status) {
    let decisionNote;
    if (status === 'REJECTED') { const v = await dialog.form({ title: 'Reject this request', danger: true, submitLabel: 'Reject', fields: [{ name: 'n', type: 'textarea', label: 'Why?', required: true, minLength: 5 }] }); if (!v) return; decisionNote = v.n; }
    else if (!(await dialog.confirm({ title: 'Approve this correction?', message: 'The affected figures will be restated.', confirmLabel: 'Approve' }))) return;
    await send({ path: `/recalculations/${r.id}/decide`, method: 'PATCH', body: { status, decisionNote }, toast: status === 'APPROVED' ? 'Approved.' : 'Rejected.' });
  }

  return (
    <div>
      <PageHeader title="Corrections to past figures" description="Changes that may mean restating a closed year." actions={canAsk && <Button onClick={ask}><Plus className="w-4 h-4" /> Ask for a correction</Button>} />
      <Notice tone="info" className="mb-4">Small changes can be corrected quietly. When the total moves a lot, a past year has to be restated, and it needs an executive’s decision.</Notice>
      <Card padded={false}>
        {!rows ? <div className="h-24 animate-pulse" /> : rows.length === 0 ? <EmptyState title="Nothing to decide">Requests to correct past figures will appear here.</EmptyState> : (
          <ul className="divide-y divide-line">{rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
              <div className="flex-1 min-w-[14rem]"><div className="font-medium">{RECALC_TRIGGER[r.triggerType] || r.triggerType}</div><div className="text-sm text-muted">{r.reason}</div><div className="text-xs text-muted mt-1 tabular-nums">Changes the total by {r.estimatedImpactPct}% · {r.cumulativeImpactPct}% added up over time · {(r.affectedPeriodIds || []).map(label).filter(Boolean).join(', ')} · asked {fmtDate(r.createdAt)}</div></div>
              <StatusBadge status={r.status} label={r.status === 'PENDING' ? 'Waiting for decision' : r.status === 'APPROVED' ? 'Approved' : 'Rejected'} />
              {r.status === 'PENDING' && isExec && <><Button size="sm" onClick={() => decide(r, 'APPROVED')}>Approve</Button><Button size="sm" variant="secondary" onClick={() => decide(r, 'REJECTED')}>Reject</Button></>}
            </li>))}</ul>)}
      </Card>
    </div>
  );
}
