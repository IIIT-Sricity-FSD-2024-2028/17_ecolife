import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilePenLine, Plus, X, Send, Hourglass, CheckCheck } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { FormField, TextInput, Select, TextArea } from '../../../components/ui/FormField';
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
import { rowProps } from '../../../components/shared/rowProps';

const LABEL = { PENDING_APPROVAL: 'Pending Executive', APPROVED: 'Approved', REJECTED: 'Rejected' };

export function AmendmentsPage() {
  const [params] = useSearchParams();
  const { data: amendments = [], isLoading } = useAmendments();
  const [tab, setTab] = useState('PENDING_APPROVAL');
  const [selectedId, setSelectedId] = useState(null);
  const selected = amendments.find((a) => a.id === selectedId) ?? null;
  const [showForm, setShowForm] = useState(!!params.get('record'));
  const pending = amendments.filter((a) => a.status === 'PENDING_APPROVAL');
  const resolved = amendments.filter((a) => a.status !== 'PENDING_APPROVAL');
  const shown = tab === 'PENDING_APPROVAL' ? pending : resolved;

  return (
    <div className="stack">
      <PageHeader subtitle="Approved entries are locked. To correct one, propose an amendment — the Executive approves it before it takes effect." actions={<Button icon={showForm ? X : Plus} variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Propose amendment'}</Button>} />
      {showForm && (
        <Card>
          <ProposeForm initialRecordId={params.get('record') ?? ''} onDone={() => setShowForm(false)} />
        </Card>
      )}

      <div>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'PENDING_APPROVAL', label: 'Pending', icon: Hourglass, count: pending.length }, { value: 'RESOLVED', label: 'Resolved', icon: CheckCheck, count: resolved.length }]} />
        <Card padded={false}>
          {!isLoading && shown.length === 0 && <EmptyState icon={FilePenLine} title="No amendments here" />}
          {shown.length > 0 && (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Entry</th><th>Change</th><th>Reason</th><th className="num">Materiality</th><th>Status</th><th>Proposed</th></tr></thead>
                <tbody>
                  {shown.map((a) => (
                    <tr key={a.id} {...rowProps(() => setSelectedId(a.id))}>
                      <td>{a.record?.departmentName} · {a.record?.resourceTypeName}<br /><span className="text-muted">{a.record && fmtRange(a.record.periodStart, a.record.periodEnd)}</span></td>
                      <td>
                        {a.proposedQuantity != null && <div>Quantity {fmtNumber(a.record?.quantity, 2)} → {fmtNumber(a.proposedQuantity, 2)} {a.record?.unit}</div>}
                        {a.proposedCost != null && <div>Cost {a.record?.cost ?? '—'} → {a.proposedCost}</div>}
                      </td>
                      <td style={{ maxWidth: 260 }}>{a.reason}{a.approvalComment && <div className="text-muted">Executive: {a.approvalComment}</div>}</td>
                      <td className="num">{fmtNumber(a.materialityPercent, 1)}%{a.triggersBaselineRecalc && <div style={{ color: 'var(--color-warning)' }}>Baseline review</div>}</td>
                      <td><StatusBadge status={a.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : a.status} label={LABEL[a.status] ?? a.status} /></td>
                      <td>{fmtDate(a.createdAt)}<br /><span className="text-muted">{a.proposedByName}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    <Drawer open title={`${rec?.departmentName ?? 'Entry'} · ${rec?.resourceTypeName ?? ''}`} subtitle={rec ? fmtRange(rec.periodStart, rec.periodEnd) : ''} onClose={onClose}>
      <p style={{ marginBottom: 'var(--space-4)' }}><StatusBadge status={a.status} label={LABEL[a.status] ?? a.status} /></p>
      <h3 className="section-title" style={{ marginTop: 0 }}>Proposed change</h3>
      <DetailList items={[
        ['Quantity (recorded)', rec ? `${fmtNumber(rec.quantity, 4)} ${rec.unit}` : null],
        ['Quantity (proposed)', a.proposedQuantity != null ? `${fmtNumber(a.proposedQuantity, 4)} ${rec?.unit ?? ''}` : 'No change'],
        ['Cost (recorded)', rec?.cost != null ? fmtMoney(rec.cost) : null],
        ['Cost (proposed)', a.proposedCost != null ? fmtMoney(a.proposedCost) : 'No change'],
        ['Materiality', `${fmtNumber(a.materialityPercent, 1)}%`],
        ['Baseline review', a.triggersBaselineRecalc ? 'Triggered (over 5%)' : 'Not triggered'],
      ]} />
      <h3 className="section-title">Reason</h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{a.reason}</p>
      <h3 className="section-title">History</h3>
      <DetailList items={[
        ['Proposed by', a.proposedByName],
        ['Proposed on', fmtDateTime(a.createdAt)],
        ['Decided by', a.approvedByName],
        ['Decided on', a.resolvedAt ? fmtDateTime(a.resolvedAt) : null],
      ]} />
      {a.approvalComment && <div className={`callout ${a.status === 'APPROVED' ? 'callout--success' : 'callout--warning'}`}><strong>Executive comment</strong><p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{a.approvalComment}</p></div>}
    </Drawer>
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

  const materiality = rec && form.quantity !== '' && rec.quantity > 0 ? (Math.abs(Number(form.quantity) - rec.quantity) / rec.quantity) * 100 : null;

  const submit = async () => {
    setError(null);
    const check = validate(amendmentSchema, form);
    setErrors(check.errors);
    if (!check.ok || !rec) return;
    const ok = await confirm({
      title: 'Submit this amendment?',
      message: `It goes to the Executive for approval${materiality != null && materiality > 5 ? ` and, at ${fmtNumber(materiality, 1)}%, is above the materiality threshold so dependent reports will be flagged if it is approved` : ''}. The recorded value does not change until it is approved.`,
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
      <FormField label="Approved entry" required error={errors.recordId}>
        <Select error={errors.recordId} value={form.recordId} onChange={set('recordId')}>
          <option value="">Select an entry…</option>
          {locked.map((r) => <option key={r.id} value={r.id}>{r.departmentName} · {r.resourceTypeName} · {fmtNumber(r.quantity, 2)} {r.unit} · {fmtRange(r.periodStart, r.periodEnd)}</option>)}
        </Select>
      </FormField>
      <div className="split-2">
        <FormField label={`Corrected quantity${rec ? ` (${rec.unit})` : ''}`} error={errors.quantity}><TextInput type="number" inputMode="decimal" step="any" min="0" error={errors.quantity} placeholder={rec ? String(rec.quantity) : '0'} value={form.quantity} onChange={set('quantity')} /></FormField>
        <FormField label="Corrected cost" error={errors.cost}><TextInput type="number" inputMode="decimal" step="any" min="0" error={errors.cost} placeholder={rec?.cost != null ? String(rec.cost) : '0.00'} value={form.cost} onChange={set('cost')} /></FormField>
      </div>
      {materiality != null && (
        <div className={`callout ${materiality > 5 ? 'callout--warning' : ''}`}>
          Change of {fmtNumber(materiality, 1)}% {materiality > 5 ? '— above the 5% materiality threshold, so dependent approved reports will be flagged for revision if this is approved.' : '— below the 5% materiality threshold.'}
        </div>
      )}
      <FormField label="Reason" required error={errors.reason}>
        <TextArea rows={3} maxLength={1000} error={errors.reason} placeholder="Why does this record need correcting?" value={form.reason} onChange={set('reason')} />
      </FormField>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <Button icon={Send} onClick={submit} loading={propose.isPending}>Submit amendment</Button>
    </div>
  );
}
