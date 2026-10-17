import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  Check,
  MessageSquareWarning,
  X,
  RefreshCw,
  FilePenLine,
  Inbox,
  Undo2,
  CheckCircle2,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowRight,
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { Tabs } from '../../../components/ui/Tabs';
import { TextArea } from '../../../components/ui/FormField';
import { commentSchema, validate } from '../../../schemas/formSchemas';
import { EmptyState } from '../../../components/shared/EmptyState';
import { RecordDetailPanel, RecordStatus } from '../../../components/shared/RecordDetailPanel';
import { EvidenceViewerModal } from '../../../components/shared/EvidenceViewerModal';
import { CommentThread } from '../../../components/shared/CommentThread';
import { useResourceRecords, useReviewResourceRecord } from '../../../hooks/useResourceRecords';
import { useRecalculate } from '../../../hooks/useRoleData';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { ApiError } from '../../../services/apiClient';
import { REVIEWER_ROUTES } from '../../../constants/routes';
import { fmtCo2e, fmtDateTime, fmtNumber, fmtRange } from '../../../utils/format';
import { Link } from 'react-router-dom';

const PAGE_SIZE = 10;

const readiness = (r) =>
  r.evidenceRequirement === 'REQUIRED' && r.evidenceCount === 0
    ? { label: 'Evidence missing', tone: 'var(--color-danger)' }
    : { label: r.evidenceRequirement === 'REQUIRED' ? 'Evidence attached' : 'Ready', tone: 'var(--color-success)' };

export function SubmissionsQueuePage() {
  const { user } = useAuth();
  const { data: records = [], isLoading } = useResourceRecords();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('SUBMITTED');
  const [searchQuery, setSearchQuery] = useState('');
  const [evidenceRecord, setEvidenceRecord] = useState(null);
  const [offset, setOffset] = useState(0);

  const currentUserId = user?.sub || user?.id;

  const groups = {
    SUBMITTED: records.filter((r) => r.status === 'SUBMITTED'),
    RETURNED: records.filter((r) => ['REJECTED', 'CHANGES_REQUESTED'].includes(r.status)),
    APPROVED: records.filter((r) => ['APPROVED', 'LOCKED'].includes(r.status)),
  };

  const q = searchQuery.trim().toLowerCase();
  const currentGroup = groups[tab] || groups.SUBMITTED;
  const shown = currentGroup.filter((r) => {
    if (!q) return true;
    return (
      (r.departmentName && r.departmentName.toLowerCase().includes(q)) ||
      (r.resourceTypeName && r.resourceTypeName.toLowerCase().includes(q)) ||
      (r.createdByName && r.createdByName.toLowerCase().includes(q)) ||
      (r.locationName && r.locationName.toLowerCase().includes(q)) ||
      (r.status && r.status.toLowerCase().includes(q)) ||
      (r.notes && r.notes.toLowerCase().includes(q))
    );
  });
  const total = shown.length;
  const paged = shown.slice(offset, offset + PAGE_SIZE);
  const openId = params.get('record');
  const open = records.find((r) => r.id === openId);

  return (
    <div>
      <PageHeader subtitle="Review what departments have submitted: approve, return for changes, or reject." />
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setOffset(0);
        }}
        tabs={[
          { value: 'SUBMITTED', label: 'Awaiting review', icon: Inbox, count: groups.SUBMITTED.length },
          { value: 'RETURNED', label: 'Returned', icon: Undo2, count: groups.RETURNED.length },
          { value: 'APPROVED', label: 'Approved', icon: CheckCircle2, count: groups.APPROVED.length },
        ]}
      />

      {/* Full-width search box replacing the department dropdown */}
      <div style={{ margin: 'var(--space-4) 0 var(--space-4)' }}>
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
            placeholder="Search submissions by department, resource, contributor, or notes..."
            aria-label="Search submissions"
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
        <div
          style={{
            marginTop: 'var(--space-2)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
          }}
        >
          Total results found: <strong style={{ color: 'var(--color-text)' }}>{total}</strong>
          {searchQuery.trim() && <span> matching &ldquo;{searchQuery.trim()}&rdquo;</span>}
        </div>
      </div>

      <Card padded={false}>
        {!isLoading && shown.length === 0 && (
          <EmptyState
            icon={searchQuery.trim() ? Search : ClipboardCheck}
            title={searchQuery.trim() ? 'No matching submissions' : 'Nothing here'}
            description={
              searchQuery.trim()
                ? `No submissions found matching "${searchQuery.trim()}". Try clearing or changing your search.`
                : tab === 'SUBMITTED'
                ? 'No submissions are waiting for review.'
                : undefined
            }
          />
        )}
        {shown.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Period</th>
                  <th>Resource</th>
                  <th className="num">Quantity</th>
                  <th>Status</th>
                  {tab === 'SUBMITTED' && <th>Review Lock</th>}
                  <th>Evidence</th>
                  <th>Readiness</th>
                  <th>Calculation</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => {
                  const rd = readiness(r);
                  const sub = r.submission;
                  const isClaimActive = !!sub?.isClaimActive;
                  const isMine = isClaimActive && sub?.claimedById === currentUserId;
                  return (
                    <tr key={r.id} className="clickable-row" onClick={() => setParams({ record: r.id })}>
                      <td>{r.departmentName}</td>
                      <td>{fmtRange(r.periodStart, r.periodEnd)}</td>
                      <td>
                        <strong>{r.resourceTypeName}</strong>
                      </td>
                      <td className="num">
                        {fmtNumber(r.quantity, 2)} {r.unit}
                      </td>
                      <td>
                        <RecordStatus status={r.status} />
                      </td>
                      {tab === 'SUBMITTED' && (
                        <td>
                          {isClaimActive ? (
                            isMine ? (
                              <span className="badge badge--success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Lock size={12} /> Claimed (You)
                              </span>
                            ) : (
                              <span className="badge badge--warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Lock size={12} /> {sub?.claimedByName || 'Another reviewer'}
                              </span>
                            )
                          ) : (
                            <span className="text-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Unlock size={12} /> Available
                            </span>
                          )}
                        </td>
                      )}
                      <td>
                        {r.evidenceCount > 0 ? (
                          <button
                            type="button"
                            className="link-button inline-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEvidenceRecord(r);
                            }}
                            title="Open attached evidence file to check"
                          >
                            Open file {r.evidenceCount > 1 ? `(${r.evidenceCount}) ` : ''}
                            <ArrowRight size={13} aria-hidden="true" />
                          </button>
                        ) : r.evidenceRequirement === 'REQUIRED' ? (
                          <span className="badge badge--danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            Missing
                          </span>
                        ) : (
                          <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                            None
                          </span>
                        )}
                      </td>
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
        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--color-border)' }}>
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

      {open && <ReviewDrawer record={open} onClose={() => setParams({})} />}

      {evidenceRecord && (
        <EvidenceViewerModal
          record={evidenceRecord}
          onClose={() => setEvidenceRecord(null)}
        />
      )}
    </div>
  );
}

function ReviewDrawer({ record, onClose }) {
  const { user } = useAuth();
  const currentUserId = user?.sub || user?.id;
  const { approve, reject, requestChanges, claim, release } = useReviewResourceRecord();
  const recalc = useRecalculate();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);
  const canReview = record.status === 'SUBMITTED';
  const blocked = record.evidenceRequirement === 'REQUIRED' && record.evidenceCount === 0;

  const sub = record.submission;
  const isClaimActive = !!sub?.isClaimActive;
  const isClaimedByMe = isClaimActive && sub?.claimedById === currentUserId;
  const isClaimedByOther = isClaimActive && sub?.claimedById && sub?.claimedById !== currentUserId;

  const onClaim = async () => {
    setError(null);
    try {
      await claim.mutateAsync(record.id);
      showToast('Claimed for review (15-min lease).', 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  const onRelease = async () => {
    setError(null);
    try {
      await release.mutateAsync(record.id);
      showToast('Released submission back to queue.', 'info');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

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
          isClaimedByOther ? (
            <div className="callout callout--warning" style={{ margin: 0 }}>
              <Lock size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              <strong>Locked for Review:</strong> This submission is currently being reviewed by {sub?.claimedByName || 'another reviewer'}. Actions are locked until their lease expires.
            </div>
          ) : isClaimedByMe ? (
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge--success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Lock size={12} /> Claimed by you (15-min lease)
                </span>
                <Button variant="ghost" size="sm" icon={Unlock} onClick={onRelease} loading={release.isPending}>
                  Release claim
                </Button>
              </div>
              <TextArea rows={2} maxLength={1000} placeholder="Comment (required to reject or request changes)" value={comment} onChange={(e) => setComment(e.target.value)} />
              {error && <p className="auth-error" role="alert">{error}</p>}
              <div className="row-actions">
                <Button icon={Check} disabled={blocked} onClick={() => decide(approve, 'Approved and locked.', false, { title: 'Approve this entry?', message: 'Approving locks the entry and calculates its emissions. Later corrections need an amendment approved by the Executive.', confirmLabel: 'Approve', icon: Check })} loading={approve.isPending}>Approve</Button>
                <Button variant="secondary" icon={MessageSquareWarning} onClick={() => decide(requestChanges, 'Changes requested.', true, { title: 'Request changes?', message: 'The entry goes back to the contributor with your comment.', confirmLabel: 'Request changes', icon: MessageSquareWarning })} loading={requestChanges.isPending}>Request changes</Button>
                <Button variant="danger" icon={X} onClick={() => decide(reject, 'Entry rejected.', true, { title: 'Reject this entry?', message: 'The entry is rejected and the contributor is told why.', confirmLabel: 'Reject entry', danger: true, icon: X })} loading={reject.isPending}>Reject</Button>
              </div>
            </div>
          ) : (
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span className="text-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-sm)' }}>
                  <Unlock size={14} /> Submission is available for review. Claim it to begin decisions.
                </span>
                <Button variant="primary" icon={Lock} onClick={onClaim} loading={claim.isPending}>
                  Claim for Review
                </Button>
              </div>
              {error && <p className="auth-error" role="alert">{error}</p>}
            </div>
          )
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
      <CommentThread entityType="resource_record" entityId={record.id} />
    </Drawer>
  );
}
