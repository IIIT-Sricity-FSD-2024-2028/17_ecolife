import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilePenLine, Plus, X, Send, Hourglass, CheckCheck, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { FormField, TextInput, TextArea } from '../../../components/ui/FormField';
import { amendmentSchema, validate } from '../../../schemas/formSchemas';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useAmendments, useProposeAmendment } from '../../../hooks/useRoleData';
import { useResourceRecords } from '../../../hooks/useResourceRecords';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber, fmtRange } from '../../../utils/format';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Drawer } from '../../../components/ui/Drawer';
import { DetailList } from '../../../components/shared/DetailList';
import { CommentThread } from '../../../components/shared/CommentThread';
import { rowProps } from '../../../components/shared/rowProps';

const PAGE_SIZE = 10;
const LABEL = { PENDING_APPROVAL: 'Pending Executive', APPROVED: 'Approved', REJECTED: 'Rejected' };

export function AmendmentsPage() {
  const [params] = useSearchParams();
  const { data: amendments = [], isLoading } = useAmendments();
  const [tab, setTab] = useState('PENDING_APPROVAL');
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const selected = amendments.find((a) => a.id === selectedId) ?? null;
  const [showForm, setShowForm] = useState(!!params.get('record'));
  const pending = amendments.filter((a) => a.status === 'PENDING_APPROVAL');
  const resolved = amendments.filter((a) => a.status !== 'PENDING_APPROVAL');
  const shown = tab === 'PENDING_APPROVAL' ? pending : resolved;
  const total = shown.length;
  const paged = shown.slice(offset, offset + PAGE_SIZE);

  return (
    <div className="stack">
      <PageHeader
        subtitle="Approved entries are locked. To correct one, propose an amendment — the Executive approves it before it takes effect."
        actions={
          <Button
            icon={showForm ? X : Plus}
            variant={showForm ? 'secondary' : 'primary'}
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? 'Cancel' : 'Propose amendment'}
          </Button>
        }
      />
      {showForm && (
        <Card>
          <ProposeForm initialRecordId={params.get('record') ?? ''} onDone={() => setShowForm(false)} />
        </Card>
      )}

      <div>
        <Tabs
          value={tab}
          onChange={(t) => {
            setTab(t);
            setOffset(0);
          }}
          tabs={[
            { value: 'PENDING_APPROVAL', label: 'Pending', icon: Hourglass, count: pending.length },
            { value: 'RESOLVED', label: 'Resolved', icon: CheckCheck, count: resolved.length },
          ]}
        />
        <Card padded={false}>
          {!isLoading && shown.length === 0 && <EmptyState icon={FilePenLine} title="No amendments here" />}
          {shown.length > 0 && (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Entry</th>
                    <th>Change</th>
                    <th>Reason</th>
                    <th className="num">Materiality</th>
                    <th>Status</th>
                    <th>Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((a) => (
                    <tr key={a.id} {...rowProps(() => setSelectedId(a.id))}>
                      <td>
                        {a.record?.departmentName} · {a.record?.resourceTypeName}
                        <br />
                        <span className="text-muted">{a.record && fmtRange(a.record.periodStart, a.record.periodEnd)}</span>
                      </td>
                      <td>
                        {a.proposedQuantity != null && (
                          <div>
                            Quantity {fmtNumber(a.record?.quantity, 2)} → {fmtNumber(a.proposedQuantity, 2)} {a.record?.unit}
                          </div>
                        )}
                        {a.proposedCost != null && <div>Cost {a.record?.cost ?? '—'} → {a.proposedCost}</div>}
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        {a.reason}
                        {a.approvalComment && <div className="text-muted">Executive: {a.approvalComment}</div>}
                      </td>
                      <td className="num">
                        {fmtNumber(a.materialityPercent, 1)}%
                        {a.triggersBaselineRecalc && <div style={{ color: 'var(--color-warning)' }}>Baseline review</div>}
                      </td>
                      <td>
                        <StatusBadge
                          status={a.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : a.status}
                          label={LABEL[a.status] ?? a.status}
                        />
                      </td>
                      <td>
                        {fmtDate(a.createdAt)}
                        <br />
                        <span className="text-muted">{a.proposedByName}</span>
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
      </div>
      {selected && <AmendmentDrawer a={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function AmendmentDrawer({ a, onClose }) {
  const rec = a.record;
  return (
    <Drawer
      open
      title={`${rec?.departmentName ?? 'Entry'} · ${rec?.resourceTypeName ?? ''}`}
      subtitle={rec ? fmtRange(rec.periodStart, rec.periodEnd) : ''}
      onClose={onClose}
    >
      <p style={{ marginBottom: 'var(--space-4)' }}>
        <StatusBadge status={a.status} label={LABEL[a.status] ?? a.status} />
      </p>
      <h3 className="section-title" style={{ marginTop: 0 }}>Proposed change</h3>
      <DetailList
        items={[
          ['Quantity (recorded)', rec ? `${fmtNumber(rec.quantity, 4)} ${rec.unit}` : null],
          ['Quantity (proposed)', a.proposedQuantity != null ? `${fmtNumber(a.proposedQuantity, 4)} ${rec?.unit ?? ''}` : 'No change'],
          ['Cost (recorded)', rec?.cost != null ? fmtMoney(rec.cost) : null],
          ['Cost (proposed)', a.proposedCost != null ? fmtMoney(a.proposedCost) : 'No change'],
          ['Materiality', `${fmtNumber(a.materialityPercent, 1)}%`],
          ['Baseline review', a.triggersBaselineRecalc ? 'Triggered (over 5%)' : 'Not triggered'],
        ]}
      />
      <h3 className="section-title">Reason</h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{a.reason}</p>
      <h3 className="section-title">History</h3>
      <DetailList
        items={[
          ['Proposed by', a.proposedByName],
          ['Proposed on', fmtDateTime(a.createdAt)],
          ['Decided by', a.approvedByName],
          ['Decided on', a.resolvedAt ? fmtDateTime(a.resolvedAt) : null],
        ]}
      />
      {a.approvalComment && (
        <div className={`callout ${a.status === 'APPROVED' ? 'callout--success' : 'callout--warning'}`}>
          <strong>Executive comment</strong>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{a.approvalComment}</p>
        </div>
      )}
      <CommentThread entityType="amendment" entityId={a.id} />
    </Drawer>
  );
}

function SearchableRecordSelect({ records, value, onChange, error }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  const selected = records.find((r) => r.id === value);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = searchTerm.trim().toLowerCase();
  const filtered = records.filter((r) => {
    if (!q) return true;
    return (
      (r.departmentName && r.departmentName.toLowerCase().includes(q)) ||
      (r.resourceTypeName && r.resourceTypeName.toLowerCase().includes(q)) ||
      (r.unit && r.unit.toLowerCase().includes(q)) ||
      (r.quantity && String(r.quantity).includes(q)) ||
      (r.periodStart && r.periodStart.includes(q)) ||
      (r.periodEnd && r.periodEnd.includes(q))
    );
  });

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {selected ? (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-primary)',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span className="badge badge--success" style={{ fontSize: '11px', padding: '2px 6px' }}>
                Approved Entry
              </span>
              <strong>{selected.departmentName}</strong> · <span>{selected.resourceTypeName}</span>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Recorded: <strong>{fmtNumber(selected.quantity, 2)} {selected.unit}</strong> · Cost: {fmtMoney(selected.cost)} · Period: {fmtRange(selected.periodStart, selected.periodEnd)}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              onChange('');
              setIsOpen(true);
            }}
          >
            Change
          </Button>
        </div>
      ) : (
        <div>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
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
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Search approved entries by department, resource, or period..."
              style={{
                width: '100%',
                padding: 'var(--space-3) var(--space-4) var(--space-3) calc(var(--space-3) + 24px)',
                borderRadius: 'var(--radius-md)',
                border: error ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                boxSizing: 'border-box',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: 'var(--space-3)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {isOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                maxHeight: '260px',
                overflowY: 'auto',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: '6px 12px',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-muted)',
                  borderBottom: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg)',
                }}
              >
                {filtered.length} approved {filtered.length === 1 ? 'entry' : 'entries'} found
              </div>
              {filtered.length === 0 ? (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  No approved entries match &ldquo;{searchTerm}&rdquo;
                </div>
              ) : (
                filtered.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      onChange(r.id);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary, rgba(0,0,0,0.04))')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                        {r.departmentName} · <span style={{ color: 'var(--color-primary)' }}>{r.resourceTypeName}</span>
                      </span>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                        {fmtRange(r.periodStart, r.periodEnd)}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Quantity: <strong>{fmtNumber(r.quantity, 2)} {r.unit}</strong> · Cost: {fmtMoney(r.cost)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProposeForm({ initialRecordId, onDone }) {
  const { data: records = [] } = useResourceRecords();
  const propose = useProposeAmendment();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ recordId: initialRecordId, quantity: '', cost: '', reason: '' });
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const locked = records.filter((r) => r.status === 'LOCKED');
  const rec = locked.find((r) => r.id === form.recordId);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const materiality =
    rec && form.quantity !== '' && rec.quantity > 0
      ? (Math.abs(Number(form.quantity) - rec.quantity) / rec.quantity) * 100
      : null;

  const submit = async () => {
    setError(null);
    const check = validate(amendmentSchema, form);
    setErrors(check.errors);
    if (!check.ok || !rec) return;
    const ok = await confirm({
      title: 'Submit this amendment?',
      message: `It goes to the Executive for approval${
        materiality != null && materiality > 5
          ? ` and, at ${fmtNumber(materiality, 1)}%, is above the materiality threshold so dependent reports will be flagged if it is approved`
          : ''
      }. The recorded value does not change until it is approved.`,
      confirmLabel: 'Submit amendment',
      icon: Send,
    });
    if (!ok) return;
    try {
      await propose.mutateAsync({
        recordId: rec.id,
        payload: {
          reason: check.data.reason,
          proposedQuantity: check.data.quantity,
          proposedCost: check.data.cost,
        },
      });
      showToast('Amendment proposed — pending Executive approval.', 'success');
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  return (
    <div>
      <FormField label="Approved entry to amend" required error={errors.recordId}>
        <SearchableRecordSelect
          records={locked}
          value={form.recordId}
          onChange={(val) => setForm((f) => ({ ...f, recordId: val }))}
          error={errors.recordId}
        />
      </FormField>
      <div className="split-2">
        <FormField label={`Corrected quantity${rec ? ` (${rec.unit})` : ''}`} error={errors.quantity}>
          <TextInput
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            error={errors.quantity}
            placeholder={rec ? String(rec.quantity) : '0'}
            value={form.quantity}
            onChange={set('quantity')}
          />
        </FormField>
        <FormField label="Corrected cost" error={errors.cost}>
          <TextInput
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            error={errors.cost}
            placeholder={rec?.cost != null ? String(rec.cost) : '0.00'}
            value={form.cost}
            onChange={set('cost')}
          />
        </FormField>
      </div>
      {materiality != null && (
        <div className={`callout ${materiality > 5 ? 'callout--warning' : ''}`}>
          Change of {fmtNumber(materiality, 1)}%{' '}
          {materiality > 5
            ? '— above the 5% materiality threshold, so dependent approved reports will be flagged for revision if this is approved.'
            : '— below the 5% materiality threshold.'}
        </div>
      )}
      <FormField label="Reason for correction" required error={errors.reason}>
        <TextArea
          rows={3}
          maxLength={1000}
          error={errors.reason}
          placeholder="Why does this record need correcting? E.g. Supplier issued corrected meter invoice."
          value={form.reason}
          onChange={set('reason')}
        />
      </FormField>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <Button icon={Send} onClick={submit} loading={propose.isPending}>
        Submit amendment
      </Button>
    </div>
  );
}
