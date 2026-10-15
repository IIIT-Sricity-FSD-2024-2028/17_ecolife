import { useState } from 'react';
import { Check, X, Hourglass, CheckCheck, FileX2 } from 'lucide-react';
import { Card, CardHeader } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { TextArea } from '../../../components/ui/FormField';
import { commentSchema, validate } from '../../../schemas/formSchemas';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useAmendments, useAmendmentDecision } from '../../../hooks/useRoleData';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtDate, fmtNumber, fmtRange } from '../../../utils/format';

export function AmendmentApprovalPage() {
  const { data: amendments = [], isLoading } = useAmendments();
  const [tab, setTab] = useState('pending');
  const pending = amendments.filter((a) => a.status === 'PENDING_APPROVAL');
  const resolved = amendments.filter((a) => a.status !== 'PENDING_APPROVAL');
  const shown = tab === 'pending' ? pending : resolved;

  return (
    <div>
      <PageHeader subtitle="Approved entries are locked. An amendment restates official data, so it needs your sign-off before it is applied and recalculated." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pending', label: 'Pending', icon: Hourglass, count: pending.length }, { value: 'resolved', label: 'Resolved', icon: CheckCheck, count: resolved.length }]} />
      {!isLoading && shown.length === 0 && <Card><EmptyState icon={tab === 'pending' ? Hourglass : FileX2} title={tab === 'pending' ? 'No amendments waiting' : 'No resolved amendments'} /></Card>}
      <div className="stack">{shown.map((a) => <AmendmentCard key={a.id} a={a} />)}</div>
    </div>
  );
}

function AmendmentCard({ a }) {
  const { approve, reject } = useAmendmentDecision();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);
  const rec = a.record;
  const pending = a.status === 'PENDING_APPROVAL';

  const decide = async (mutation, done, needsComment) => {
    setError(null);
    const check = validate(commentSchema(needsComment, 'Add a short reason for rejecting'), { comment });
    if (!check.ok) return setError(check.errors.comment);
    const approving = !needsComment;
    const ok = await confirm({
      title: approving ? 'Approve this amendment?' : 'Reject this amendment?',
      message: approving
        ? `The recorded value will be replaced and its emissions recalculated.${a.triggersBaselineRecalc ? ' Dependent approved reports will be flagged for revision.' : ''}`
        : 'The recorded data stays as it is and the Reviewer is told why.',
      confirmLabel: approving ? 'Approve amendment' : 'Reject amendment',
      danger: !approving,
      icon: approving ? Check : X,
    });
    if (!ok) return;
    try { await mutation.mutateAsync({ id: a.id, comment: comment.trim() || undefined }); showToast(done, 'success'); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Something went wrong.'); }
  };

  return (
    <Card>
      <CardHeader
        title={`${rec?.departmentName} · ${rec?.resourceTypeName}`}
        subtitle={rec ? fmtRange(rec.periodStart, rec.periodEnd) : ''}
        actions={<StatusBadge status={a.status} label={pending ? 'Pending' : a.status === 'APPROVED' ? 'Approved' : 'Rejected'} />}
      />
      <table className="data-table" style={{ marginBottom: 'var(--space-4)' }}>
        <thead><tr><th></th><th className="num">Recorded</th><th className="num">Proposed</th></tr></thead>
        <tbody>
          <tr><td>Quantity ({rec?.unit})</td><td className="num">{fmtNumber(rec?.quantity, 2)}</td><td className="num">{a.proposedQuantity != null ? <strong>{fmtNumber(a.proposedQuantity, 2)}</strong> : '—'}</td></tr>
          <tr><td>Cost</td><td className="num">{rec?.cost ?? '—'}</td><td className="num">{a.proposedCost != null ? <strong>{a.proposedCost}</strong> : '—'}</td></tr>
        </tbody>
      </table>
      <p><strong>Reason:</strong> {a.reason}</p>
      <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>Proposed by {a.proposedByName} on {fmtDate(a.createdAt)}</p>
      <div className={`callout ${a.triggersBaselineRecalc ? 'callout--warning' : ''}`} style={{ marginTop: 'var(--space-3)' }}>
        Change of {fmtNumber(a.materialityPercent, 1)}%.{' '}
        {a.triggersBaselineRecalc ? 'This exceeds the 5% materiality threshold: approving it will flag dependent approved reports for revision.' : 'Below the 5% materiality threshold — no baseline review is triggered.'}
      </div>

      {pending ? (
        <>
          <TextArea rows={2} maxLength={1000} placeholder="Comment (required to reject)" value={comment} onChange={(e) => setComment(e.target.value)} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="row-actions" style={{ marginTop: 'var(--space-3)' }}>
            <Button icon={Check} onClick={() => decide(approve, 'Amendment approved and applied.', false)} loading={approve.isPending}>Approve</Button>
            <Button variant="danger" icon={X} onClick={() => decide(reject, 'Amendment rejected.', true)} loading={reject.isPending}>Reject</Button>
          </div>
        </>
      ) : (
        a.approvalComment && <p><strong>{a.approvedByName ?? 'Executive'}:</strong> {a.approvalComment}</p>
      )}
    </Card>
  );
}
