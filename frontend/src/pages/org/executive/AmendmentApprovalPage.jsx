import { useState } from 'react';
import {
  Check,
  X,
  Hourglass,
  CheckCheck,
  FileX2,
  FilePenLine,
  ChevronLeft,
  ChevronRight,
  Search,
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
import { DetailList } from '../../../components/shared/DetailList';
import { CommentThread } from '../../../components/shared/CommentThread';
import { rowProps } from '../../../components/shared/rowProps';
import { useAmendments, useAmendmentDecision } from '../../../hooks/useRoleData';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, fmtRange } from '../../../utils/format';

const PAGE_SIZE = 10;

export function AmendmentApprovalPage() {
  const { data: amendments = [], isLoading } = useAmendments();
  const [tab, setTab] = useState('pending');
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [openId, setOpenId] = useState(null);

  const pending = amendments.filter((a) => a.status === 'PENDING_APPROVAL');
  const resolved = amendments
    .filter((a) => a.status !== 'PENDING_APPROVAL')
    .sort((a, b) => (b.resolvedAt ?? b.updatedAt).localeCompare(a.resolvedAt ?? a.updatedAt));

  const list = tab === 'pending' ? pending : resolved;

  const q = searchQuery.trim().toLowerCase();
  const filtered = list.filter((a) => {
    if (!q) return true;
    const rec = a.record;
    return (
      (rec?.departmentName && rec.departmentName.toLowerCase().includes(q)) ||
      (rec?.resourceTypeName && rec.resourceTypeName.toLowerCase().includes(q)) ||
      (a.reason && a.reason.toLowerCase().includes(q)) ||
      (a.proposedByName && a.proposedByName.toLowerCase().includes(q)) ||
      (a.approvedByName && a.approvedByName.toLowerCase().includes(q)) ||
      (a.approvalComment && a.approvalComment.toLowerCase().includes(q))
    );
  });

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + PAGE_SIZE);
  const open = amendments.find((a) => a.id === openId);

  return (
    <div className="stack">
      <PageHeader subtitle="Approved entries are locked. An amendment restates official data, so it needs your sign-off before it is applied and recalculated." />
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setOffset(0);
        }}
        tabs={[
          { value: 'pending', label: 'Pending approval', icon: Hourglass, count: pending.length },
          { value: 'resolved', label: 'Decision history', icon: CheckCheck, count: resolved.length },
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
            placeholder="Search amendments by department, resource, reason, or submitter..."
            aria-label="Search amendments"
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
            icon={searchQuery.trim() ? Search : tab === 'pending' ? Hourglass : FileX2}
            title={
              searchQuery.trim()
                ? 'No matching amendments found'
                : tab === 'pending'
                ? 'No amendments waiting for approval'
                : 'No resolved amendments yet'
            }
            description={
              searchQuery.trim()
                ? 'Try adjusting your search terms.'
                : tab === 'pending'
                ? 'Amendments proposed by Reviewers will appear here for your approval.'
                : undefined
            }
          />
        )}

        {filtered.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entry</th>
                  <th>Proposed change</th>
                  <th>Reason</th>
                  <th className="num">Materiality</th>
                  <th>Status</th>
                  <th>Proposed</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((a) => {
                  const rec = a.record;
                  return (
                    <tr key={a.id} {...rowProps(() => setOpenId(a.id))}>
                      <td>
                        <strong>{rec?.departmentName} · {rec?.resourceTypeName}</strong>
                        <br />
                        <span className="text-muted">{rec && fmtRange(rec.periodStart, rec.periodEnd)}</span>
                      </td>
                      <td>
                        {a.proposedQuantity != null && (
                          <div>
                            Quantity: {fmtNumber(rec?.quantity, 2)} → <strong>{fmtNumber(a.proposedQuantity, 2)}</strong> {rec?.unit}
                          </div>
                        )}
                        {a.proposedCost != null && (
                          <div>
                            Cost: {rec?.cost != null ? fmtMoney(rec.cost) : '—'} → <strong>{fmtMoney(a.proposedCost)}</strong>
                          </div>
                        )}
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.reason}
                        </div>
                        {a.approvalComment && (
                          <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                            Executive: {a.approvalComment}
                          </div>
                        )}
                      </td>
                      <td className="num">
                        <strong>{fmtNumber(a.materialityPercent, 1)}%</strong>
                        {a.triggersBaselineRecalc && (
                          <div style={{ color: 'var(--color-warning)', fontSize: 'var(--font-size-xs)' }}>
                            Baseline review
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusBadge
                          status={a.status}
                          label={a.status === 'PENDING_APPROVAL' ? 'Pending' : a.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                        />
                      </td>
                      <td>
                        {fmtDate(a.createdAt)}
                        <br />
                        <span className="text-muted">{a.proposedByName}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Button
                          size="sm"
                          variant={tab === 'pending' ? 'primary' : 'secondary'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenId(a.id);
                          }}
                        >
                          {tab === 'pending' ? 'Review & decide' : 'View'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
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

      {open && <DecisionDrawer a={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function DecisionDrawer({ a, onClose }) {
  const { approve, reject } = useAmendmentDecision();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);
  const rec = a.record;
  const pending = a.status === 'PENDING_APPROVAL';

  const decide = async (mutation, done, needsComment) => {
    setError(null);
    const check = validate(commentSchema(needsComment, 'Add a reason for rejecting this amendment'), { comment });
    if (!check.ok) return setError(check.errors.comment);
    const approving = !needsComment;
    const ok = await confirm({
      title: approving ? 'Approve this amendment?' : 'Reject this amendment?',
      message: approving
        ? `The recorded value will be replaced and its emissions recalculated.${
            a.triggersBaselineRecalc ? ' Dependent approved reports will be flagged for revision.' : ''
          }`
        : 'The recorded data stays as it is and the Reviewer is notified why.',
      confirmLabel: approving ? 'Approve amendment' : 'Reject amendment',
      danger: !approving,
      icon: approving ? Check : X,
    });
    if (!ok) return;
    try {
      await mutation.mutateAsync({ id: a.id, comment: comment.trim() || undefined });
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
      width={660}
      title={rec ? `${rec.departmentName} · ${rec.resourceTypeName}` : 'Amendment review'}
      subtitle={rec ? fmtRange(rec.periodStart, rec.periodEnd) : ''}
      footer={
        pending ? (
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <TextArea
              rows={2}
              maxLength={1000}
              placeholder="Comment (required to reject)"
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
                onClick={() => decide(approve, 'Amendment approved and applied.', false)}
                loading={approve.isPending}
              >
                Approve amendment
              </Button>
              <Button
                variant="danger"
                icon={X}
                onClick={() => decide(reject, 'Amendment rejected.', true)}
                loading={reject.isPending}
              >
                Reject amendment
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      <p style={{ marginBottom: 'var(--space-4)' }}>
        <StatusBadge
          status={a.status}
          label={pending ? 'Pending Executive approval' : a.status === 'APPROVED' ? 'Approved' : 'Rejected'}
        />
      </p>

      {a.triggersBaselineRecalc && (
        <div className="callout callout--warning" style={{ marginBottom: 'var(--space-4)' }}>
          <strong>Baseline Review Triggered</strong>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)' }}>
            This change of {fmtNumber(a.materialityPercent, 1)}% exceeds the 5% materiality threshold. Approving it will flag dependent approved reports for revision.
          </p>
        </div>
      )}

      <h3 className="section-title" style={{ marginTop: 0 }}>Proposed change</h3>
      <DetailList
        items={[
          ['Quantity (recorded)', rec ? `${fmtNumber(rec.quantity, 4)} ${rec.unit}` : null],
          [
            'Quantity (proposed)',
            a.proposedQuantity != null ? `${fmtNumber(a.proposedQuantity, 4)} ${rec?.unit ?? ''}` : 'No change',
          ],
          ['Cost (recorded)', rec?.cost != null ? fmtMoney(rec.cost) : null],
          ['Cost (proposed)', a.proposedCost != null ? fmtMoney(a.proposedCost) : 'No change'],
          ['Materiality', `${fmtNumber(a.materialityPercent, 1)}%`],
          ['Baseline review impact', a.triggersBaselineRecalc ? 'Triggered (exceeds 5%)' : 'Not triggered'],
        ]}
      />

      <h3 className="section-title">Reason for correction</h3>
      <p style={{ whiteSpace: 'pre-wrap', marginBottom: 'var(--space-4)' }}>{a.reason}</p>

      <h3 className="section-title">Timeline &amp; provenance</h3>
      <DetailList
        items={[
          ['Proposed by', a.proposedByName],
          ['Proposed on', fmtDateTime(a.createdAt)],
          ['Decided by', a.approvedByName ?? (pending ? 'Awaiting Executive' : '—')],
          ['Decided on', a.resolvedAt ? fmtDateTime(a.resolvedAt) : null],
        ]}
      />

      {!pending && a.approvalComment && (
        <div
          className={`callout ${a.status === 'APPROVED' ? 'callout--success' : 'callout--warning'}`}
          style={{ marginTop: 'var(--space-4)' }}
        >
          <strong>Executive decision comment ({a.approvedByName ?? 'Executive'})</strong>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{a.approvalComment}</p>
        </div>
      )}

      <div style={{ marginTop: 'var(--space-4)' }}>
        <CommentThread entityType="amendment" entityId={a.id} />
      </div>
    </Drawer>
  );
}
