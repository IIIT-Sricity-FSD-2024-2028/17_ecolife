import { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FilePlus2, FilterX, FileX2, SearchX, Send, Pencil, Save, X, Paperclip } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { FormField, TextInput, Select, TextArea } from '../../../components/ui/FormField';
import { recordEditSchema, validate, evidenceFileError } from '../../../schemas/formSchemas';
import { EmptyState } from '../../../components/shared/EmptyState';
import { RecordDetailPanel, RecordStatus } from '../../../components/shared/RecordDetailPanel';
import { useResourceRecords, useUpdateResourceRecord, useSubmitResourceRecord } from '../../../hooks/useResourceRecords';
import { resourceRecordsService } from '../../../services/resourceRecordsService';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../../services/apiClient';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { SUBMISSION_STATUS_LABELS } from '../../../constants/roles';
import { CONTRIBUTOR_ROUTES } from '../../../constants/routes';
import { fmtDate, fmtNumber, fmtRange } from '../../../utils/format';

const EDITABLE = ['DRAFT', 'REJECTED', 'CHANGES_REQUESTED'];

export function SubmissionHistoryPage() {
  const { data: records = [], isLoading } = useResourceRecords();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState({ status: '', resource: '', from: '', to: '', q: '' });

  const resources = useMemo(() => [...new Set(records.map((r) => r.resourceTypeName))].sort(), [records]);
  const filtered = records.filter(
    (r) =>
      (!filters.status || r.status === filters.status) &&
      (!filters.resource || r.resourceTypeName === filters.resource) &&
      (!filters.from || r.periodEnd.slice(0, 10) >= filters.from) &&
      (!filters.to || r.periodStart.slice(0, 10) <= filters.to) &&
      (!filters.q || `${r.resourceTypeName} ${r.notes ?? ''}`.toLowerCase().includes(filters.q.toLowerCase())),
  );

  const openId = params.get('record');
  const open = records.find((r) => r.id === openId);
  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

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
                {Object.entries(SUBMISSION_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
              <Button variant="ghost" size="sm" icon={FilterX} onClick={() => setFilters({ status: '', resource: '', from: '', to: '', q: '' })}>Clear</Button>
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
                {filtered.map((r) => (
                  <tr key={r.id} className="clickable-row" onClick={() => setParams({ record: r.id })}>
                    <td>{fmtRange(r.periodStart, r.periodEnd)}</td>
                    <td>{r.resourceTypeName}</td>
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
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ quantity: record.quantity, cost: record.cost ?? '', notes: record.notes ?? '' });
  const [uploading, setUploading] = useState(false);
  const editable = EDITABLE.includes(record.status);

  const fail = (err, fallback = 'Something went wrong.') => showToast(err instanceof ApiError ? err.message : fallback, 'error');

  const [formErrors, setFormErrors] = useState({});

  const save = async () => {
    const check = validate(recordEditSchema, { quantity: String(form.quantity ?? ''), cost: String(form.cost ?? ''), notes: form.notes ?? '' });
    setFormErrors(check.errors);
    if (!check.ok) return;
    const ok = await confirm({ title: 'Save your changes?', message: 'The entry will be updated with the quantity, cost and notes you entered.', confirmLabel: 'Save changes', icon: Save });
    if (!ok) return;
    try {
      await update.mutateAsync({
        id: record.id,
        payload: { quantity: check.data.quantity, cost: check.data.cost, notes: check.data.notes },
      });
      showToast('Entry updated.', 'success');
      setEditing(false);
    } catch (err) { fail(err); }
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
          <div className="row-actions">
            <Button icon={Send} onClick={doSubmit} loading={submit.isPending}>{record.status === 'DRAFT' ? 'Submit for review' : 'Resubmit for review'}</Button>
            {!editing && <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
          </div>
        )
      }
    >
      <p style={{ marginBottom: 'var(--space-4)' }}><RecordStatus status={record.status} /></p>

      {editing ? (
        <div className="stack" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="split-2">
            <FormField label={`Quantity (${record.unit})`} error={formErrors.quantity} required><TextInput type="number" inputMode="decimal" step="any" min="0" error={formErrors.quantity} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></FormField>
            <FormField label="Cost" error={formErrors.cost}><TextInput type="number" inputMode="decimal" step="any" min="0" placeholder="0.00" error={formErrors.cost} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></FormField>
          </div>
          <FormField label="Notes" error={formErrors.notes}><TextArea rows={3} maxLength={1000} error={formErrors.notes} placeholder="Notes for the reviewer" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField>
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
    </Drawer>
  );
}
