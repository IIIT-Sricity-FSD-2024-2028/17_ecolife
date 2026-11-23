import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, PageHeader, SelectField, StatusBadge } from '../../components/ui';
import { toOptions } from '../../hooks/useOptions';
import { fmtDate } from '../../utils/formatters';
import { AUDIT_STATUS } from '../../utils/labels';

export default function InternalAuditFindingsPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const dialog = useDialog();
  const { data: rows, refetch } = useApi('/internal-audit/findings');
  const { data: periods } = useApi('/periods');
  const [status, setStatus] = useState('');
  const isAuditor = user?.roles?.includes('INTERNAL_AUDITOR');
  const shown = (rows || []).filter((r) => !status || r.status === status);

  async function add() {
    const v = await dialog.form({ title: 'Record an audit finding', description: 'What you tested and what you found.', submitLabel: 'Save finding', wide: true, fields: [
      { name: 'controlDomain', type: 'text', label: 'What did you test?', required: true, placeholder: 'e.g. Fuel meter readings against supplier invoices' },
      { name: 'status', type: 'select', label: 'Result', required: true, defaultValue: 'DEFICIENCY', options: toOptions(['PASS', 'DEFICIENCY', 'REMEDIATION_REQUIRED'], AUDIT_STATUS) },
      { name: 'periodId', type: 'select', label: 'Month', options: (periods || []).map((p) => ({ value: p.id, label: p.label })), hint: 'Leave empty if it covers the whole year.' },
      { name: 'summary', type: 'textarea', label: 'What you found', required: true, minLength: 10 },
      { name: 'remediation', type: 'textarea', label: 'What must be done to fix it', hint: 'Required unless the control works.', minLength: 5 }] });
    if (!v) return;
    try { await apiFetch('/internal-audit/findings', { method: 'POST', body: JSON.stringify({ controlDomain: v.controlDomain.trim(), status: v.status, periodId: v.periodId || undefined, summary: v.summary.trim(), remediation: v.remediation?.trim() || undefined }) }); pushToast('Finding saved.'); refetch(); } catch (e) { pushToast(e.message, 'error'); }
  }
  async function update(r) {
    const v = await dialog.form({ title: 'Update finding', description: r.controlDomain, submitLabel: 'Save', wide: true, fields: [
      ...(isAuditor ? [{ name: 'status', type: 'select', label: 'Status', required: true, defaultValue: r.status, options: toOptions(['PASS', 'DEFICIENCY', 'REMEDIATION_REQUIRED', 'CLOSED'], AUDIT_STATUS) }] : []),
      { name: 'remediation', type: 'textarea', label: isAuditor ? 'Fix required' : 'What has been done to fix it', defaultValue: r.remediation || '', minLength: 5, required: !isAuditor }] });
    if (!v) return;
    try { await apiFetch(`/internal-audit/findings/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: isAuditor ? v.status : undefined, remediation: v.remediation?.trim() || undefined }) }); pushToast('Saved.'); refetch(); } catch (e) { pushToast(e.message, 'error'); }
  }

  return (
    <div>
      <PageHeader title="Audit findings" description="Checks on how your figures are produced, and what was found." actions={isAuditor && <Button onClick={add}><Plus className="w-4 h-4" /> Record a finding</Button>} />
      <Card padded={false}>
        <div className="px-4 py-3 border-b border-line"><SelectField className="w-56" label="" aria-label="Status" value={status} onChange={setStatus} placeholder="Any status" options={toOptions(['PASS', 'DEFICIENCY', 'REMEDIATION_REQUIRED', 'CLOSED'], AUDIT_STATUS)} /></div>
        {!rows ? <div className="h-24 animate-pulse" /> : shown.length === 0 ? <EmptyState title="No findings">{isAuditor ? 'Record what you test and find here.' : 'The internal auditor has not recorded any findings.'}</EmptyState> : (
          <ul className="divide-y divide-line">{shown.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
              <div className="flex-1 min-w-[16rem]"><div className="font-medium">{r.controlDomain}</div><div className="text-sm mt-0.5">{r.summary}</div>{r.remediation && <div className="text-sm text-muted mt-1">To fix: {r.remediation}</div>}<div className="text-xs text-muted mt-1">{r.period?.label || 'Whole year'} · {fmtDate(r.createdAt)}</div></div>
              <StatusBadge status={r.status === 'PASS' || r.status === 'CLOSED' ? 'ACTIVE' : r.status} label={AUDIT_STATUS[r.status]} />
              {(isAuditor || user?.roles?.includes('SUSTAINABILITY_LEAD')) && r.status !== 'CLOSED' && <Button size="sm" variant="secondary" onClick={() => update(r)}>Update</Button>}
            </li>))}</ul>)}
      </Card>
    </div>
  );
}
