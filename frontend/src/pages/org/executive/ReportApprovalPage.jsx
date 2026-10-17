import { useState } from 'react';
import {
  FileCheck2,
  Check,
  Undo2,
  Hourglass,
  History,
  FileX2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
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
import { CommentThread } from '../../../components/shared/CommentThread';
import { rowProps } from '../../../components/shared/rowProps';
import { useReports, useReportActions } from '../../../hooks/useOrgData';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtCo2e, fmtDate, fmtDateTime, fmtRange } from '../../../utils/format';

const PAGE_SIZE = 10;

export function ReportApprovalPage() {
  const { data: reports = [], isLoading } = useReports();
  const [tab, setTab] = useState('pending');
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [openId, setOpenId] = useState(null);

  const pending = reports.filter((r) => r.status === 'PENDING_APPROVAL');
  const decided = reports
    .filter((r) => ['APPROVED', 'REVISION_REQUESTED', 'SUPERSEDED'].includes(r.status))
    .sort((a, b) => (b.approvedAt ?? b.updatedAt).localeCompare(a.approvedAt ?? a.updatedAt));

  const list = tab === 'pending' ? pending : decided;

  const q = searchQuery.trim().toLowerCase();
  const filtered = list.filter((r) => {
    if (!q) return true;
    return (
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.notes && r.notes.toLowerCase().includes(q)) ||
      (r.createdByName && r.createdByName.toLowerCase().includes(q)) ||
      (r.approvedByName && r.approvedByName.toLowerCase().includes(q)) ||
      (r.approvalComment && r.approvalComment.toLowerCase().includes(q)) ||
      (r.periodStart && r.periodStart.includes(q)) ||
      (r.periodEnd && r.periodEnd.includes(q)) ||
      `v${r.version}`.includes(q)
    );
  });

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + PAGE_SIZE);
  const open = reports.find((r) => r.id === openId);

  return (
    <div className="stack">
      <PageHeader subtitle="Approving freezes a report permanently. Request a revision if anything needs to change first." />
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setOffset(0);
        }}
        tabs={[
          { value: 'pending', label: 'Awaiting your approval', icon: Hourglass, count: pending.length },
          { value: 'ledger', label: 'Decision history', icon: History, count: decided.length },
        ]}
      />

      {/* Unified Search Filter matching Reviewer */}
      <div style={{ margin: 'var(--space-2) 0' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search
            size={18}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 'var(--space-3)',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOffset(0);
            }}
            placeholder="Search reports by title, period, prepared by, or notes..."
            aria-label="Search reports"
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-4) var(--space-3) calc(var(--space-3) + 26px)',
              fontSize: 'var(--font-size-md)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setOffset(0);
              }}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 'var(--space-3)',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          Total results found: <strong style={{ color: 'var(--color-text)' }}>{total}</strong>
          {searchQuery.trim() && <span> matching &ldquo;{searchQuery.trim()}&rdquo;</span>}
        </div>
      </div>

      <Card padded={false}>
        {!isLoading && filtered.length === 0 && (
          <EmptyState
            icon={searchQuery.trim() ? Search : tab === 'pending' ? FileCheck2 : FileX2}
            title={
              searchQuery.trim()
                ? 'No matching reports found'
                : tab === 'pending'
                ? 'Nothing to approve'
                : 'No decisions yet'
            }
            description={
              searchQuery.trim()
                ? 'Try adjusting your search terms.'
                : tab === 'pending'
                ? 'Reports appear here when a Reviewer submits them for sign-off.'
                : undefined
            }
          />
        )}

        {filtered.length > 0 && tab === 'pending' && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Period</th>
                  <th>Version</th>
                  <th className="num">Emissions</th>
                  <th>Prepared by</th>
                  <th>Submitted</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} {...rowProps(() => setOpenId(r.id))}>
                    <td>
                      <strong>{r.title}</strong>
                      {r.notes && (
                        <div
                          className="text-muted"
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            maxWidth: 280,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.notes}
                        </div>
                      )}
                    </td>
                    <td>{fmtRange(r.periodStart, r.periodEnd)}</td>
                    <td>v{r.version}</td>
                    <td className="num">{fmtCo2e(r.contentJson?.summary?.totalCo2eKg)}</td>
                    <td>{r.createdByName}</td>
                    <td>{fmtDate(r.updatedAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(r.id);
                        }}
                      >
                        Review &amp; decide
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && tab === 'ledger' && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Decided</th>
                  <th>Report</th>
                  <th>Version</th>
                  <th>Decision</th>
                  <th>Decided by</th>
                  <th>Comment</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} {...rowProps(() => setOpenId(r.id))}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.approvedAt ?? r.updatedAt)}</td>
                    <td>
                      <strong>{r.title}</strong>
                      <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                        {fmtRange(r.periodStart, r.periodEnd)}
                      </div>
                    </td>
                    <td>v{r.version}</td>
                    <td>
                      <StatusBadge
                        status={r.status}
                        label={
                          r.status === 'REVISION_REQUESTED'
                            ? 'Revision requested'
                            : r.status === 'SUPERSEDED'
                            ? 'Approved · superseded'
                            : 'Approved'
                        }
                      />
                    </td>
                    <td>{r.approvedByName ?? '—'}</td>
                    <td className="text-muted" style={{ maxWidth: 280 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.approvalComment || '—'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(r.id);
                        }}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-4) var(--space-5)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <div className="row-actions">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
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
      message: approving
        ? 'Approving freezes this version permanently. It can only be changed by a new version.'
        : 'The Reviewer will see your comment and can create a new version.',
      confirmLabel: approving ? 'Approve & publish' : 'Request revision',
      icon: approving ? Check : Undo2,
    });
    if (!ok) return;
    try {
      await mutation.mutateAsync({ id: report.id, comment: comment.trim() || undefined });
      showToast(done, 'success');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width={700}
      title={report.title}
      subtitle={`Version ${report.version} · ${fmtRange(report.periodStart, report.periodEnd)}`}
      footer={
        pending && (
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <TextArea
              rows={2}
              maxLength={1000}
              placeholder="Comment (required to request a revision)"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (error) setError(null);
              }}
            />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="row-actions">
              <Button
                icon={Check}
                onClick={() => decide(approve, 'Report approved and published.', false)}
                loading={approve.isPending}
              >
                Approve &amp; publish
              </Button>
              <Button
                variant="secondary"
                icon={Undo2}
                onClick={() => decide(requestRevision, 'Sent back for revision.', true)}
                loading={requestRevision.isPending}
              >
                Request revision
              </Button>
            </div>
          </div>
        )
      }
    >
      {report.submissionNote && (
        <div className="callout" style={{ marginBottom: 'var(--space-4)' }}>
          <strong>Note from {report.createdByName ?? 'the Reviewer'}</strong>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{report.submissionNote}</p>
        </div>
      )}
      {!pending && report.approvalComment && (
        <div
          className={`callout ${report.status === 'REVISION_REQUESTED' ? 'callout--warning' : 'callout--success'}`}
          style={{ marginBottom: 'var(--space-4)' }}
        >
          <strong>
            {report.status === 'REVISION_REQUESTED' ? 'Revision requested' : 'Approved'}
            {report.approvedByName ? ` by ${report.approvedByName}` : ''}
          </strong>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{report.approvalComment}</p>
        </div>
      )}
      <ReportContent report={report} />
      <div style={{ marginTop: 'var(--space-4)' }}>
        <CommentThread entityType="report" entityId={report.id} />
      </div>
    </Drawer>
  );
}
