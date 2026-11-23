import { useDialog } from '../ui/Dialogs';
import React, { useMemo } from 'react';
import { apiFetch } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

const BADGE = {
  DRAFT: 'bg-paper text-text',
  SUBMITTED: 'bg-brand-50 text-brand-700',
  APPROVED: 'bg-ok-50 text-ok-600',
  REJECTED: 'bg-danger-50 text-danger-600'
};

export function StatusBadge({ status }) {
  return <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${BADGE[status] || BADGE.DRAFT}`}>{String(status || '').toLowerCase()}</span>;
}

/** Facility and open-period pickers shared by the data-entry pages. Nothing is chosen for the user. */
export function useScope(facilities, periods) {
  const open = useMemo(() => (periods || []).filter((p) => ['OPEN', 'REOPENED'].includes(p.status)), [periods]);
  return { open };
}

export function ScopePicker({ facilities, periods, facilityId, periodId, onFacility, onPeriod }) {
  const open = (periods || []).filter((p) => ['OPEN', 'REOPENED'].includes(p.status));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <select value={facilityId} onChange={(e) => onFacility(e.target.value)} className="h-9 px-2.5 rounded-lg input-glass text-xs">
        <option value="">Choose facility</option>
        {(facilities || []).filter((f) => f.approvalStatus === 'APPROVED').map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      <select value={periodId} onChange={(e) => onPeriod(e.target.value)} className="h-9 px-2.5 rounded-lg input-glass text-xs">
        <option value="">Choose open reporting period</option>
        {open.map((p) => <option key={p.id} value={p.id}>{p.label}{p.status === 'REOPENED' ? ' (reopened)' : ''}</option>)}
      </select>
    </div>
  );
}

/** Submit / approve / reject / delete buttons that follow the record's status and the user's role. */
export function RowActions({ kind, row, onDone }) {
  const { pushToast } = useToast();
  const dialog = useDialog();
  const { user } = useAuth();
  const roles = user?.roles || [];
  const canReview = roles.includes('SUSTAINABILITY_LEAD') || roles.includes('EXECUTIVE_APPROVER');
  async function call(path, method = 'POST', body) {
    try {
      await apiFetch(`/resources/${kind}/${row.id}${path}`, { method, body: body ? JSON.stringify(body) : undefined });
      onDone?.();
    } catch (err) { pushToast(err.message, 'error'); }
  }
  async function reject() {
    const v = await dialog.form({ title: 'Send back for correction', description: 'The person who entered this record will see your note and can fix and resubmit it.', submitLabel: 'Send back', danger: true,
      fields: [{ name: 'note', type: 'textarea', label: 'What needs fixing?', placeholder: 'e.g. Withdrawal looks too high. Please check the meter reading for April.', required: true, minLength: 5 }] });
    if (v) await call('/review', 'POST', { decision: 'REJECTED', reviewNote: v.note.trim() });
  }
  async function remove() {
    const ok = await dialog.confirm({ title: 'Delete this record?', message: 'Only drafts and sent-back records can be deleted. This cannot be undone.', confirmLabel: 'Delete record', danger: true });
    if (ok) await call('', 'DELETE');
  }
  const btn = 'btn-sm';
  return (
    <div className="flex gap-1 justify-end">
      {['DRAFT', 'REJECTED'].includes(row.status) && <button type="button" className={`${btn} btn-primary`} onClick={() => call('/submit')}>Send for review</button>}
      {['DRAFT', 'REJECTED'].includes(row.status) && <button type="button" className={`${btn} btn-secondary`} onClick={remove}>Delete</button>}
      {row.status === 'SUBMITTED' && canReview && <button type="button" className={`${btn} btn-primary`} onClick={() => call('/review', 'POST', { decision: 'APPROVED' })}>Approve</button>}
      {row.status === 'SUBMITTED' && canReview && <button type="button" className={`${btn} btn-secondary`} onClick={reject}>Send back</button>}
    </div>
  );
}

export const statusColumn = { key: 'status', label: 'Status', accessor: (r) => r.status, render: (r) => <span title={r.reviewNote || ''}><StatusBadge status={r.status} />{r.status === 'REJECTED' && r.reviewNote ? <span className="ml-1 text-[11px] text-danger-600">{r.reviewNote}</span> : null}</span> };
export const actionsColumn = (kind, onDone) => ({ key: 'actions', label: '', accessor: () => '', render: (r) => <RowActions kind={kind} row={r} onDone={onDone} /> });
