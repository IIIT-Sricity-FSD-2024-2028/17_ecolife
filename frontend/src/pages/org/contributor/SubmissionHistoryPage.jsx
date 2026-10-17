import { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FilePlus2, FilterX, FileX2, SearchX, Send, Pencil, Save, X, Paperclip, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { FormField, TextInput, Select, TextArea } from '../../../components/ui/FormField';
import { recordEditSchema, validate, evidenceFileError } from '../../../schemas/formSchemas';
import { EmptyState } from '../../../components/shared/EmptyState';
import { RecordDetailPanel, RecordStatus } from '../../../components/shared/RecordDetailPanel';
import { CommentThread } from '../../../components/shared/CommentThread';
import { rowProps } from '../../../components/shared/rowProps';
import { useResourceRecords, useUpdateResourceRecord, useSubmitResourceRecord, useDeleteResourceRecord, useResourceTypes } from '../../../hooks/useResourceRecords';
import { resourceRecordsService } from '../../../services/resourceRecordsService';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../../services/apiClient';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { SUBMISSION_STATUS_LABELS, ROLE_BASED_STATUS_LABELS } from '../../../constants/roles';
import { CONTRIBUTOR_ROUTES } from '../../../constants/routes';
import { fmtDate, fmtNumber, fmtRange } from '../../../utils/format';

const PAGE_SIZE = 10;
const EDITABLE = ['DRAFT', 'REJECTED', 'CHANGES_REQUESTED'];

export function SubmissionHistoryPage() {
  const { data: records = [], isLoading } = useResourceRecords();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({ status: '', resource: '', from: '', to: '', q: '' });
  const [offset, setOffset] = useState(0);

  const statusOptions = useMemo(() => {
    const raw = Object.entries(ROLE_BASED_STATUS_LABELS.CONTRIBUTOR || SUBMISSION_STATUS_LABELS);
    const seen = new Set();
    const result = [];
    for (const [key, label] of raw) {
      if (!seen.has(label)) {
        seen.add(label);
        result.push({ value: key, label });
      }
    }
    return result;
  }, []);

  const resources = useMemo(
    () => [...new Set(records.map((r) => r.resourceTypeName?.trim()).filter(Boolean))].sort(),
    [records],
  );
  const filtered = records.filter(
    (r) =>
      (!filters.status ||
        (filters.status === 'APPROVED'
          ? r.status === 'APPROVED' || r.status === 'LOCKED'
          : r.status === filters.status)) &&
      (!filters.resource || r.resourceTypeName === filters.resource) &&
      (!filters.from || r.periodEnd.slice(0, 10) >= filters.from) &&
      (!filters.to || r.periodStart.slice(0, 10) <= filters.to) &&
      (!filters.q || `${r.resourceTypeName} ${r.notes ?? ''}`.toLowerCase().includes(filters.q.toLowerCase())),
  );

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + PAGE_SIZE);

  const openId = params.get('record');
  const open = records.find((r) => r.id === openId);
  const setFilter = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setOffset(0);
  };

  return (
    <div>
      <PageHeader subtitle="Every entry you’ve submitted, with its review status." actions={<Link to={CONTRIBUTOR_ROUTES.SUBMIT}><Button icon={FilePlus2}>New submission</Button></Link>} />

      <Card padded={false}>
        <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}>
          <div className="filters">
            <FormField label="Search"><TextInput placeholder="Resource or notes" value={filters.q} onChange={setFilter('q')} /></FormField>
            <FormField label="Status">
              <Select value={filters.status} onChange={setFilter('status')}>
                <option value="">All statuses</option>
                {statusOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Resource">
              <Select value={filters.resource} onChange={setFilter('resource')}>
                <option value="">All resources</option>
                {resources.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </FormField>
            <FormField label="From"><TextInput type="date" value={filters.from} onChange={setFilter('from')} /></FormField>
            <FormField label="To"><TextInput type="date" value={filters.to} onChange={setFilter('to')} /></FormField>
            {Object.values(filters).some(Boolean) && (
              <Button variant="ghost" size="sm" icon={FilterX} onClick={() => { setFilters({ status: '', resource: '', from: '', to: '', q: '' }); setOffset(0); }}>Clear</Button>
            )}
          </div>
        </div>

        {isLoading && <p className="text-muted" style={{ padding: 'var(--space-5)' }}>Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <EmptyState icon={records.length ? SearchX : FileX2} title={records.length ? 'No entries match these filters' : 'No submissions yet'} description={records.length ? undefined : 'Entries you log will appear here.'} />
        )}
        {filtered.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Period</th><th>Resource</th><th className="num">Quantity</th><th>Status</th><th>Submitted</th><th>Evidence</th></tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} {...rowProps(() => setParams({ record: r.id }))}>
                    <td>{fmtRange(r.periodStart, r.periodEnd)}</td>
                    <td>
                      <strong>{r.resourceTypeName}</strong>
                    </td>
                    <td className="num">{fmtNumber(r.quantity, 2)} {r.unit}</td>
                    <td><RecordStatus status={r.status} /></td>
                    <td>{fmtDate(r.submittedAt)}</td>
                    <td>
                      {r.evidenceCount > 0 ? `${r.evidenceCount} file${r.evidenceCount > 1 ? 's' : ''}` : r.evidenceRequirement === 'REQUIRED' ? <span style={{ color: 'var(--color-warning)' }}>Missing</span> : '—'}
                    </td>
                  </tr>
                ))}
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

      {open && <RecordDrawer record={open} onClose={() => setParams({})} />}
    </div>
  );
}

function RecordDrawer({ record, onClose }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const update = useUpdateResourceRecord();
  const submit = useSubmitResourceRecord();
  const deleteRecord = useDeleteResourceRecord();
  const { data: types = [] } = useResourceTypes();
  const currentType = types.find((t) => t.id === record.resourceTypeId);
  const unitOptions = useMemo(() => {
    const list = currentType?.units?.map((u) => u.unit) ?? [];
    if (record.unit && !list.includes(record.unit)) {
      list.push(record.unit);
    }
    return [...new Set(list.map((u) => u?.trim()).filter(Boolean))];
  }, [currentType, record.unit]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    quantity: record.quantity,
    unit: record.unit,
    cost: record.cost ?? '',
    notes: record.notes ?? '',
    periodStart: record.periodStart?.slice(0, 10) ?? '',
    periodEnd: record.periodEnd?.slice(0, 10) ?? '',
  });
  const [uploading, setUploading] = useState(false);
  const editable = EDITABLE.includes(record.status);

  const fail = (err, fallback = 'Something went wrong.') => showToast(err instanceof ApiError ? err.message : fallback, 'error');

  const [formErrors, setFormErrors] = useState({});

  const save = async () => {
    const check = validate(recordEditSchema, {
      quantity: String(form.quantity ?? ''),
      unit: form.unit || undefined,
      cost: String(form.cost ?? ''),
      notes: form.notes ?? '',
    });
    setFormErrors(check.errors);
    if (!check.ok) return;

    if (form.periodStart && form.periodEnd && new Date(form.periodEnd) < new Date(form.periodStart)) {
      showToast('Period end cannot be before start date.', 'error');
      return;
    }

    const ok = await confirm({
      title: 'Save your changes?',
      message: 'The entry will be updated with the figures and period you entered.',
      confirmLabel: 'Save changes',
      icon: Save,
    });
    if (!ok) return;
    try {
      await update.mutateAsync({
        id: record.id,
        payload: {
          quantity: check.data.quantity,
          unit: check.data.unit,
          cost: check.data.cost,
          notes: check.data.notes,
          periodStart: form.periodStart || undefined,
          periodEnd: form.periodEnd || undefined,
        },
      });
      showToast('Entry updated.', 'success');
      setEditing(false);
    } catch (err) { fail(err); }
  };

  const doDelete = async () => {
    if (record.status !== 'DRAFT') {
      showToast('Only draft entries can be deleted. Records that have been submitted for review cannot be deleted.', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Delete this draft?',
      message: 'This will permanently remove the draft entry and any attached evidence files.',
      confirmLabel: 'Delete draft',
      tone: 'danger',
      icon: Trash2,
    });
    if (!ok) return;
    try {
      await deleteRecord.mutateAsync(record.id);
      showToast('Draft deleted.', 'success');
      onClose();
    } catch (err) {
      fail(err, 'Failed to delete draft.');
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileProblem = evidenceFileError(file);
    if (fileProblem) { showToast(fileProblem, 'error'); e.target.value = ''; return; }
    const ok = await confirm({ title: `Attach “${file.name}”?`, message: 'The file will be added to this entry as supporting evidence.', confirmLabel: 'Upload file', icon: Paperclip });
    if (!ok) { e.target.value = ''; return; }
    setUploading(true);
    try {
      await resourceRecordsService.uploadEvidence(record.id, file);
      qc.invalidateQueries({ queryKey: ['evidence', record.id] });
      qc.invalidateQueries({ queryKey: ['resource-records'] });
      showToast('Evidence uploaded.', 'success');
    } catch (err) { fail(err, 'Upload failed.'); } finally { setUploading(false); e.target.value = ''; }
  };

  const doSubmit = async () => {
    const ok = await confirm({
      title: record.status === 'DRAFT' ? 'Submit this entry for review?' : 'Resubmit this entry for review?',
      message: 'A Reviewer will check it. You won’t be able to edit it while it is in review.',
      confirmLabel: record.status === 'DRAFT' ? 'Submit for review' : 'Resubmit',
      icon: Send,
    });
    if (!ok) return;
    try {
      await submit.mutateAsync(record.id);
      showToast('Submitted for review.', 'success');
      onClose();
    } catch (err) { fail(err); }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={record.resourceTypeName}
      subtitle={fmtRange(record.periodStart, record.periodEnd)}
      footer={
        editable && (
          <div className="row-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
            <div className="row-actions">
              <Button icon={Send} onClick={doSubmit} loading={submit.isPending}>
                {record.status === 'DRAFT' ? 'Submit for review' : 'Resubmit for review'}
              </Button>
              {!editing && (
                <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
            {!editing && record.status === 'DRAFT' && (
              <Button variant="danger" icon={Trash2} onClick={doDelete} loading={deleteRecord.isPending}>
                Delete draft
              </Button>
            )}
          </div>
        )
      }
    >
      <p style={{ marginBottom: 'var(--space-4)' }}><RecordStatus status={record.status} /></p>

      {editing ? (
        <div className="stack" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="split-2">
            <FormField label="Quantity" error={formErrors.quantity} required>
              <TextInput
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                error={formErrors.quantity}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </FormField>
            <FormField label="Unit" error={formErrors.unit} required>
              {unitOptions.length > 1 ? (
                <Select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  error={formErrors.unit}
                >
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </Select>
              ) : (
                <TextInput
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  error={formErrors.unit}
                />
              )}
            </FormField>
          </div>
          <div className="split-2">
            <FormField label="Period start">
              <TextInput
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
              />
            </FormField>
            <FormField label="Period end">
              <TextInput
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Cost" error={formErrors.cost}>
            <TextInput
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="0.00"
              error={formErrors.cost}
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
            />
          </FormField>
          <FormField label="Notes" error={formErrors.notes}>
            <TextArea
              rows={3}
              maxLength={1000}
              error={formErrors.notes}
              placeholder="Notes for the reviewer"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </FormField>
          <div className="row-actions">
            <Button icon={Save} onClick={save} loading={update.isPending}>Save changes</Button>
            <Button variant="ghost" icon={X} onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <RecordDetailPanel record={record} />
      )}

      {editable && !editing && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <label className="form-field__label" htmlFor="evidence-upload">Attach evidence</label>
          <div><input id="evidence-upload" type="file" onChange={upload} disabled={uploading} /></div>
          <p className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>PDF, images, CSV or Excel, up to 10 MB.</p>
        </div>
      )}
      <CommentThread entityType="resource_record" entityId={record.id} />
    </Drawer>
  );
}
