import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Check, MessageSquareWarning, X, RefreshCw, FilePenLine, Inbox, Undo2, CheckCircle2, FileEdit } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { Tabs } from '../../../components/ui/Tabs';
import { FormField, TextArea, Select } from '../../../components/ui/FormField';
import { commentSchema, validate } from '../../../schemas/formSchemas';
import { EmptyState } from '../../../components/shared/EmptyState';
import { RecordDetailPanel, RecordStatus } from '../../../components/shared/RecordDetailPanel';
import { useResourceRecords, useReviewResourceRecord } from '../../../hooks/useResourceRecords';
import { useRecalculate } from '../../../hooks/useRoleData';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { REVIEWER_ROUTES } from '../../../constants/routes';
import { fmtCo2e, fmtDateTime, fmtNumber, fmtRange } from '../../../utils/format';
import { Link } from 'react-router-dom';

const readiness = (r) =>
  r.evidenceRequirement === 'REQUIRED' && r.evidenceCount === 0
    ? { label: 'Evidence missing', tone: 'var(--color-danger)' }
    : { label: r.evidenceRequirement === 'REQUIRED' ? 'Evidence attached' : 'Ready', tone: 'var(--color-success)' };

export function SubmissionsQueuePage() {
  const { data: records = [], isLoading } = useResourceRecords();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('SUBMITTED');
  const [dept, setDept] = useState('');

  const departments = [...new Set(records.map((r) => r.departmentName))].sort();
  const groups = {
    SUBMITTED: records.filter((r) => r.status === 'SUBMITTED'),
    RETURNED: records.filter((r) => ['REJECTED', 'CHANGES_REQUESTED'].includes(r.status)),
    APPROVED: records.filter((r) => ['APPROVED', 'LOCKED'].includes(r.status)),
    DRAFT: records.filter((r) => r.status === 'DRAFT'),
  };
  const shown = groups[tab].filter((r) => !dept || r.departmentName === dept);
  const openId = params.get('record');
  const open = records.find((r) => r.id === openId);

  return (
    <div>
      <PageHeader subtitle="Review what departments have submitted: approve, return for changes, or reject." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'SUBMITTED', label: 'Awaiting review', icon: Inbox, count: groups.SUBMITTED.length },
        { value: 'RETURNED', label: 'Returned', icon: Undo2, count: groups.RETURNED.length },
        { value: 'APPROVED', label: 'Approved', icon: CheckCircle2, count: groups.APPROVED.length },
        { value: 'DRAFT', label: 'Drafts', icon: FileEdit, count: groups.DRAFT.length },
      ]} />
      <div className="filters">
        <FormField label="Department">
          <Select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        </FormField>
      </div>

      <Card padded={false}>
        {!isLoading && shown.length === 0 && <EmptyState icon={ClipboardCheck} title="Nothing here" description={tab === 'SUBMITTED' ? 'No submissions are waiting for review.' : undefined} />}
        {shown.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Department</th><th>Period</th><th>Resource</th><th className="num">Quantity</th><th>Status</th><th>Readiness</th><th>Calculation</th><th>Submitted</th></tr></thead>
              <tbody>
                {shown.map((r) => {
                  const rd = readiness(r);
                  return (
                    <tr key={r.id} className="clickable-row" onClick={() => setParams({ record: r.id })}>
                      <td>{r.departmentName}</td>
                      <td>{fmtRange(r.periodStart, r.periodEnd)}</td>
                      <td>{r.resourceTypeName}</td>
                      <td className="num">{fmtNumber(r.quantity, 2)} {r.unit}</td>
                      <td><RecordStatus status={r.status} /></td>
                      <td style={{ color: rd.tone }}>{rd.label}</td>
                      <td>{r.calculation ? fmtCo2e(r.calculation.co2eKg) : <span className="text-muted">On approval</span>}</td>
                      <td>{fmtDateTime(r.submittedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && <ReviewDrawer record={open} onClose={() => setParams({})} />}
    </div>
  );
}

function ReviewDrawer({ record, onClose }) {
  const { approve, reject, requestChanges } = useReviewResourceRecord();
  const recalc = useRecalculate();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);
  const canReview = record.status === 'SUBMITTED';
  const blocked = record.evidenceRequirement === 'REQUIRED' && record.evidenceCount === 0;

  const decide = async (mutation, label, needsComment, confirmOpts) => {
    setError(null);
    const check = validate(commentSchema(needsComment, 'Add a comment so the contributor knows what to fix'), { comment });
    if (!check.ok) return setError(check.errors.comment);
    const ok = await confirm(confirmOpts);
    if (!ok) return;
    try {
      await mutation.mutateAsync({ id: record.id, comment: comment.trim() || undefined });
      showToast(label, 'success');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  const doRecalc = async () => {
    const ok = await confirm({ title: 'Recalculate this entry?', message: 'Its emissions will be recalculated using the emission factors currently in effect.', confirmLabel: 'Recalculate', icon: RefreshCw });
    if (!ok) return;
    try { await recalc.mutateAsync(record.id); showToast('Recalculated with current factors.', 'success'); }
    catch (err) { showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error'); }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={`${record.departmentName} · ${record.resourceTypeName}`}
      subtitle={fmtRange(record.periodStart, record.periodEnd)}
      footer={
        canReview ? (
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <TextArea rows={2} maxLength={1000} placeholder="Comment (required to reject or request changes)" value={comment} onChange={(e) => setComment(e.target.value)} />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="row-actions">
              <Button icon={Check} onClick={() => decide(approve, 'Approved and locked.', false, { title: 'Approve this entry?', message: 'Approving locks the entry and calculates its emissions. Later corrections need an amendment approved by the Executive.', confirmLabel: 'Approve', icon: Check })} loading={approve.isPending}>Approve</Button>
              <Button variant="secondary" icon={MessageSquareWarning} onClick={() => decide(requestChanges, 'Changes requested.', true, { title: 'Request changes?', message: 'The entry goes back to the contributor with your comment.', confirmLabel: 'Request changes', icon: MessageSquareWarning })} loading={requestChanges.isPending}>Request changes</Button>
              <Button variant="danger" icon={X} onClick={() => decide(reject, 'Entry rejected.', true, { title: 'Reject this entry?', message: 'The entry is rejected and the contributor is told why.', confirmLabel: 'Reject entry', danger: true, icon: X })} loading={reject.isPending}>Reject</Button>
            </div>
          </div>
        ) : record.status === 'LOCKED' ? (
          <div className="row-actions">
            <Button variant="secondary" icon={RefreshCw} onClick={doRecalc} loading={recalc.isPending}>Recalculate</Button>
            <Link to={`${REVIEWER_ROUTES.AMENDMENTS}?record=${record.id}`}><Button variant="secondary" icon={FilePenLine}>Propose amendment</Button></Link>
          </div>
        ) : null
      }
    >
      <p style={{ marginBottom: 'var(--space-4)' }}><RecordStatus status={record.status} /></p>
      {canReview && blocked && <div className="callout callout--danger">This entry is above its evidence threshold and has no supporting file attached.</div>}
      <RecordDetailPanel record={record} />
    </Drawer>
  );
}
