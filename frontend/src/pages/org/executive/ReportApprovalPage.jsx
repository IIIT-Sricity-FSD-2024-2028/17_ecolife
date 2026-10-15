import { useState } from 'react';
import { FileCheck2, Check, Undo2, Hourglass, History, FileX2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { Tabs } from '../../../components/ui/Tabs';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { TextArea } from '../../../components/ui/FormField';
import { commentSchema, validate } from '../../../schemas/formSchemas';
import { EmptyState } from '../../../components/shared/EmptyState';
import { ReportContent } from '../../../components/shared/ReportContent';
import { useReports, useReportActions } from '../../../hooks/useOrgData';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtCo2e, fmtDate, fmtDateTime, fmtRange } from '../../../utils/format';

export function ReportApprovalPage() {
  const { data: reports = [], isLoading } = useReports();
  const [tab, setTab] = useState('pending');
  const [openId, setOpenId] = useState(null);

  const pending = reports.filter((r) => r.status === 'PENDING_APPROVAL');
  const decided = reports
    .filter((r) => ['APPROVED', 'REVISION_REQUESTED', 'SUPERSEDED'].includes(r.status))
    .sort((a, b) => (b.approvedAt ?? b.updatedAt).localeCompare(a.approvedAt ?? a.updatedAt));
  const open = reports.find((r) => r.id === openId);

  return (
    <div>
      <PageHeader subtitle="Approving freezes a report permanently. Request a revision if anything needs to change first." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pending', label: 'Awaiting your approval', icon: Hourglass, count: pending.length }, { value: 'ledger', label: 'Decision history', icon: History, count: decided.length }]} />

      <Card padded={false}>
        {!isLoading && tab === 'pending' && pending.length === 0 && <EmptyState icon={FileCheck2} title="Nothing to approve" description="Reports appear here when a Reviewer submits them." />}
        {tab === 'pending' && pending.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Report</th><th>Period</th><th>Version</th><th className="num">Emissions</th><th>Prepared by</th><th>Submitted</th></tr></thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id} className="clickable-row" onClick={() => setOpenId(r.id)}>
                    <td><strong>{r.title}</strong></td>
                    <td>{fmtRange(r.periodStart, r.periodEnd)}</td>
                    <td>v{r.version}</td>
                    <td className="num">{fmtCo2e(r.contentJson?.summary?.totalCo2eKg)}</td>
                    <td>{r.createdByName}</td>
                    <td>{fmtDate(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'ledger' && decided.length === 0 && <EmptyState icon={FileX2} title="No decisions yet" />}
        {tab === 'ledger' && decided.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Decided</th><th>Report</th><th>Version</th><th>Decision</th><th>By</th><th>Comment</th></tr></thead>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.id} className="clickable-row" onClick={() => setOpenId(r.id)}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.approvedAt ?? r.updatedAt)}</td>
                    <td>{r.title}</td>
                    <td>v{r.version}</td>
                    <td><StatusBadge status={r.status} label={r.status === 'REVISION_REQUESTED' ? 'Revision requested' : r.status === 'SUPERSEDED' ? 'Approved · superseded' : 'Approved'} /></td>
                    <td>{r.approvedByName ?? '—'}</td>
                    <td className="text-muted" style={{ maxWidth: 280 }}>{r.approvalComment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && <DecisionDrawer report={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function DecisionDrawer({ report, onClose }) {
  const { approve, requestRevision } = useReportActions();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);
  const pending = report.status === 'PENDING_APPROVAL';

  const decide = async (mutation, done, needsComment) => {
    setError(null);
    const check = validate(commentSchema(needsComment, 'Tell the Reviewer what needs to change'), { comment });
    if (!check.ok) return setError(check.errors.comment);
    const approving = !needsComment;
    const ok = await confirm({
      title: approving ? `Approve “${report.title}”?` : `Send “${report.title}” back for revision?`,
      message: approving ? 'Approving freezes this version permanently. It can only be changed by a new version.' : 'The Reviewer will see your comment and can create a new version.',
      confirmLabel: approving ? 'Approve & publish' : 'Request revision',
      icon: approving ? Check : Undo2,
    });
    if (!ok) return;
    try {
      await mutation.mutateAsync({ id: report.id, comment: comment.trim() || undefined });
      showToast(done, 'success');
      onClose();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Something went wrong.'); }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width={660}
      title={report.title}
      subtitle={`Version ${report.version} · ${fmtRange(report.periodStart, report.periodEnd)}`}
      footer={pending && (
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <TextArea rows={2} maxLength={1000} placeholder="Comment (required to request a revision)" value={comment} onChange={(e) => setComment(e.target.value)} />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="row-actions">
            <Button icon={Check} onClick={() => decide(approve, 'Report approved and frozen.', false)} loading={approve.isPending}>Approve &amp; publish</Button>
            <Button variant="secondary" icon={Undo2} onClick={() => decide(requestRevision, 'Sent back for revision.', true)} loading={requestRevision.isPending}>Request revision</Button>
          </div>
        </div>
      )}
    >
      {report.submissionNote && (
        <div className="callout">
          <strong>Note from {report.createdByName ?? 'the Reviewer'}</strong>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{report.submissionNote}</p>
        </div>
      )}
      {!pending && report.approvalComment && (
        <div className={`callout ${report.status === 'REVISION_REQUESTED' ? 'callout--warning' : 'callout--success'}`}>
          <strong>{report.status === 'REVISION_REQUESTED' ? 'Revision requested' : 'Approved'}{report.approvedByName ? ` by ${report.approvedByName}` : ''}</strong>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{report.approvalComment}</p>
        </div>
      )}
      <ReportContent report={report} />
    </Drawer>
  );
}

