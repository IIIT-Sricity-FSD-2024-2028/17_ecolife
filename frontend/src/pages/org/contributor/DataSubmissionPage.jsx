import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PencilLine, FileUp, Plus, Trash2, Send, Save, Download, Upload, Check, History, ClipboardList, ArrowRight, Paperclip, X, Building2 } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Card, CardHeader } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { Button } from '../../../components/ui/Button';
import { ScopeBadge } from '../../../components/ui/ScopeBadge';
import { FormField, TextInput, Select, TextArea } from '../../../components/ui/FormField';
import { useResourceTypes } from '../../../hooks/useResourceRecords';
import { useLocations } from '../../../hooks/useOrgData';
import { submissionPeriodSchema, entryRowSchema, validate, evidenceFileError, csvFileError } from '../../../schemas/formSchemas';
import { useProfile } from '../../../hooks/useRoleData';
import { useImportBatches, useImportCsv } from '../../../hooks/useRoleData';
import { resourceRecordsService } from '../../../services/resourceRecordsService';
import { ApiError } from '../../../services/apiClient';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import { CONTRIBUTOR_ROUTES } from '../../../constants/routes';
import { downloadText, fmtDateTime, fmtNumber, fmtRange, isoToday, toCsv } from '../../../utils/format';

let rowSeq = 1;
const newRow = () => ({ key: rowSeq++, resourceTypeId: '', quantity: '', unit: '', cost: '', file: null, marketInstrument: '', status: 'idle', error: null });

export function DataSubmissionPage() {
  const [tab, setTab] = useState('manual');
  return (
    <div>
      <PageHeader subtitle="Log resource usage for your department. Each line becomes its own entry that is reviewed separately." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[{ value: 'manual', label: 'Manual entry', icon: PencilLine }, { value: 'csv', label: 'CSV upload', icon: FileUp }]}
      />
      {tab === 'manual' ? <ManualEntry /> : <CsvUpload />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ManualEntry() {
  const { data: types = [] } = useResourceTypes();
  const { data: profile } = useProfile();
  const { data: locations = [] } = useLocations(profile?.departmentId ?? undefined);
  const [locationId, setLocationId] = useState('');
  const { showToast } = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [period, setPeriod] = useState({ start: '', end: '' });
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([newRow()]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);

  const typeById = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])), [types]);

  const selectableTypes = useMemo(() => {
    if (profile?.allowedResourceTypeIds && profile.allowedResourceTypeIds.length > 0) {
      return types.filter((t) => profile.allowedResourceTypeIds.includes(t.id));
    }
    return types;
  }, [types, profile?.allowedResourceTypeIds]);

  const patch = (key, changes) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  const removeRow = async (r, i) => {
    const hasData = r.resourceTypeId || r.quantity !== '' || r.cost !== '' || r.file;
    if (hasData) {
      const ok = await confirm({ title: `Remove line ${i + 1}?`, message: 'What you entered on this line will be discarded.', confirmLabel: 'Remove line', danger: true, icon: Trash2 });
      if (!ok) return;
    }
    setRows((rs) => rs.filter((x) => x.key !== r.key));
  };

  // ---- pre-submission validation (mirrors the server's rules) -------------
  const issues = useMemo(() => {
    const out = [];
    const p = validate(submissionPeriodSchema, { periodStart: period.start, periodEnd: period.end, notes });
    Object.values(p.errors).forEach((text) => out.push({ scope: 'period', text }));

    if (period.start && period.end) {
      const s = new Date(period.start);
      const e = new Date(period.end);
      if (differenceInDays(e, s) > 366) {
        out.push({ scope: 'period', text: 'Activity period duration cannot exceed 366 days (1 year) per GHG Protocol accounting rules.' });
      }
    }

    rows.forEach((r, i) => {
      const t = typeById[r.resourceTypeId];
      const label = `Line ${i + 1}`;
      const v = validate(entryRowSchema, { resourceTypeId: r.resourceTypeId, unit: r.unit, quantity: String(r.quantity), cost: String(r.cost) });
      const errs = { ...v.errors };
      if (!r.resourceTypeId) delete errs.unit; // one message is enough until a resource is chosen
      Object.values(errs).forEach((text) => out.push({ scope: r.key, text: `${label}: ${text}.` }));
      if (r.file) {
        const fileProblem = evidenceFileError(r.file);
        if (fileProblem) out.push({ scope: r.key, text: `${label}: ${fileProblem}.` });
      }
      if (v.ok && t?.evidenceThreshold != null && v.data.quantity > t.evidenceThreshold && !r.file) {
        out.push({ scope: r.key, text: `${label}: above ${fmtNumber(t.evidenceThreshold)} ${r.unit || ''} — attach supporting evidence to submit.`, evidence: true });
      }
      if (profile?.allowedResourceTypeIds && profile.allowedResourceTypeIds.length > 0 && r.resourceTypeId) {
        if (!profile.allowedResourceTypeIds.includes(r.resourceTypeId)) {
          out.push({ scope: r.key, text: `${label}: Resource "${t?.name || 'Selected'}" is outside ${profile.departmentName || 'your department'}'s authorized operational boundary.` });
        }
      }
    });
    return out;
  }, [rows, period, notes, typeById, profile]);

  const warnings = rows
    .map((r, i) => {
      const t = typeById[r.resourceTypeId];
      return t?.evidenceThreshold != null && Number(r.quantity) > t.evidenceThreshold * 3
        ? `Line ${i + 1}: more than 3× the evidence threshold — this will raise a critical alert for review.`
        : null;
    })
    .filter(Boolean);

  const totals = useMemo(() => {
    const byUnit = {};
    let cost = 0;
    rows.forEach((r) => {
      const q = Number(r.quantity);
      if (r.unit && q > 0) {
        const label = `${typeById[r.resourceTypeId]?.name ?? '—'} (${r.unit})`;
        byUnit[label] = (byUnit[label] ?? 0) + q;
      }
      if (r.cost !== '' && Number(r.cost) > 0) cost += Number(r.cost);
    });
    return { byUnit, cost };
  }, [rows, typeById]);

  const blocking = issues.filter((i) => !i.evidence);
  const needsEvidence = issues.filter((i) => i.evidence);
  const canSaveDrafts = blocking.length === 0 && !busy;
  const canSubmit = issues.length === 0 && !busy;

  const run = async (submit) => {
    const count = rows.filter((r) => r.status !== 'done').length;
    const ok = await confirm({
      title: submit ? `Submit ${count} ${count === 1 ? 'entry' : 'entries'} for review?` : `Save ${count} ${count === 1 ? 'entry' : 'entries'} as ${count === 1 ? 'a draft' : 'drafts'}?`,
      message: submit ? 'Each line is sent to a Reviewer as its own entry. You can’t edit an entry while it is in review.' : 'Drafts are only visible to you until you submit them from Submission History.',
      confirmLabel: submit ? 'Submit for review' : 'Save drafts',
      icon: submit ? Send : Save,
    });
    if (!ok) return;
    setBusy(true);
    setSummary(null);
    let done = 0;
    let failed = 0;
    for (const r of rows) {
      if (r.status === 'done') continue;
      patch(r.key, { status: 'working', error: null });
      try {
        const rec = await resourceRecordsService.create({
          resourceTypeId: r.resourceTypeId,
          quantity: Number(r.quantity),
          unit: r.unit,
          cost: r.cost !== '' ? Number(r.cost) : undefined,
          periodStart: period.start,
          periodEnd: period.end,
          locationId: locationId || undefined,
          marketInstrument: r.marketInstrument || undefined,
          notes: notes.trim() || undefined,
        });
        if (r.file) await resourceRecordsService.uploadEvidence(rec.id, r.file);
        if (submit) await resourceRecordsService.submit(rec.id);
        patch(r.key, { status: 'done' });
        done += 1;
      } catch (err) {
        patch(r.key, { status: 'error', error: err instanceof ApiError ? err.message : 'Something went wrong.' });
        failed += 1;
      }
    }
    qc.invalidateQueries({ queryKey: ['resource-records'] });
    qc.invalidateQueries({ queryKey: ['alerts'] });
    setSummary({ done, failed, submitted: submit });
    if (failed === 0) {
      showToast(submit ? `${done} entr${done === 1 ? 'y' : 'ies'} submitted for review.` : `${done} draft${done === 1 ? '' : 's'} saved.`, 'success');
      setRows([newRow()]);
      setNotes('');
      setLocationId('');
    }
    setBusy(false);
  };

  return (
    <Card>
      <CardHeader icon={ClipboardList} title="Usage entries" subtitle="Add every resource you want to report for this period, then submit them together." />

      {profile?.departmentName && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-subtle, rgba(255, 255, 255, 0.03))',
            border: '1px solid var(--color-border)',
            marginBottom: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={16} style={{ color: 'var(--color-primary)' }} />
              <span>Operational Boundary: {profile.departmentName}</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 'var(--font-weight-medium)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(5, 150, 105, 0.1)',
                  color: 'var(--color-primary)',
                  border: '1px solid rgba(5, 150, 105, 0.2)',
                }}
              >
                GHG Protocol Scope Custody
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {selectableTypes.length < types.length
                ? `Authorized Emission Sources: ${selectableTypes.map((t) => t.name).join(', ')}. Outside resources are restricted to maintain audit verification integrity.`
                : 'All standard emission sources configured for this organization are available for intake.'}
            </p>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            Max Activity Window: <strong>366 Days</strong>
          </div>
        </div>
      )}

      <div className="split-2">
        <FormField label="Period start" required>
          <TextInput type="date" max={isoToday()} value={period.start} onChange={(e) => setPeriod((p) => ({ ...p, start: e.target.value }))} />
        </FormField>
        <FormField label="Period end" required>
          <TextInput type="date" value={period.end} onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.value }))} />
        </FormField>
      </div>
      <p className="text-muted" style={{ fontSize: 'var(--font-size-xs)', margin: '-8px 0 var(--space-3)' }}>
        Note: Activity periods must be consecutive, non-overlapping, and cannot fall within closed Executive-certified reports.
      </p>

      {rows.map((r, i) => {
        const t = typeById[r.resourceTypeId];
        const needs = t?.evidenceThreshold != null && Number(r.quantity) > t.evidenceThreshold;
        const rowIssue = issues.some((x) => x.scope === r.key);
        return (
          <div key={r.key} className={`entry-row${rowIssue ? ' has-issue' : ''}`}>
            <FormField label={i === 0 ? 'Resource type' : undefined}>
              <Select aria-label={`Line ${i + 1} resource type`} value={r.resourceTypeId} disabled={r.status === 'done'}
                onChange={(e) => {
                  const nt = typeById[e.target.value];
                  patch(r.key, { resourceTypeId: e.target.value, unit: nt?.units?.find((u) => u.isDefault)?.unit ?? nt?.units?.[0]?.unit ?? '' });
                }}>
                <option value="">Select a resource…</option>
                {selectableTypes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}{x.category ? ` (${x.category})` : ''}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={i === 0 ? 'Quantity' : undefined}>
              <TextInput aria-label={`Line ${i + 1} quantity`} type="number" inputMode="decimal" step="any" min="0" max="1000000000" placeholder="0" value={r.quantity} disabled={r.status === 'done'} onChange={(e) => patch(r.key, { quantity: e.target.value })} />
            </FormField>
            <FormField label={i === 0 ? 'Unit' : undefined}>
              <Select aria-label={`Line ${i + 1} unit`} value={r.unit} disabled={!t || r.status === 'done'} onChange={(e) => patch(r.key, { unit: e.target.value })}>
                <option value="">Unit…</option>
                {t?.units.map((u) => <option key={u.unit} value={u.unit}>{u.unit}</option>)}
              </Select>
            </FormField>
            <FormField label={i === 0 ? 'Cost (optional)' : undefined}>
              <TextInput aria-label={`Line ${i + 1} cost`} type="number" inputMode="decimal" step="any" min="0" max="1000000000" placeholder="0.00" value={r.cost} disabled={r.status === 'done'} onChange={(e) => patch(r.key, { cost: e.target.value })} />
            </FormField>
            <div style={{ paddingTop: i === 0 ? 26 : 0 }}>
              <Button variant="ghost" size="sm" icon={Trash2} disabled={rows.length === 1 || busy} onClick={() => removeRow(r, i)}>Remove</Button>
            </div>

            <div className="entry-row__extra" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {t?.category && <ScopeBadge category={t.category} />}
              </div>
              {r.status !== 'done' && (
                r.file ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--color-primary)' }}>
                    <Paperclip size={13} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' }}>
                      {r.file.name}
                    </span>
                    <span className="text-muted" style={{ fontSize: '11px' }}>
                      ({fmtNumber(r.file.size / 1024, 0)} KB)
                    </span>
                    <button
                      type="button"
                      title="Remove attached file"
                      aria-label={`Remove attached file ${r.file.name}`}
                      onClick={() => patch(r.key, { file: null })}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--color-danger)',
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-xs)',
                      color: needs ? 'var(--color-warning)' : 'var(--color-text-muted)',
                      fontWeight: needs ? 'var(--font-weight-semibold)' : 'normal',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: needs ? '1px dashed var(--color-warning)' : '1px dashed var(--color-border)',
                      backgroundColor: needs ? 'rgba(234, 179, 8, 0.08)' : 'transparent',
                    }}
                  >
                    <Paperclip size={13} />
                    <span>
                      {needs ? (
                        <>
                          <strong>Evidence required</strong> (above {fmtNumber(t?.evidenceThreshold)} {r.unit}): Click to attach
                        </>
                      ) : (
                        'Attach supporting evidence (optional)'
                      )}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.csv,.xls,.xlsx"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        patch(r.key, { file: f });
                        e.target.value = '';
                      }}
                    />
                  </label>
                )
              )}
              {t?.category === 'ELECTRICITY' && r.status !== 'done' && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)' }}>
                  <span className="text-muted">Market attribute:</span>
                  <select
                    aria-label={`Line ${i + 1} Scope 2 market attribute`}
                    value={r.marketInstrument || ''}
                    onChange={(e) => patch(r.key, { marketInstrument: e.target.value })}
                    style={{
                      padding: '2px 8px',
                      fontSize: 'var(--font-size-xs)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                    }}
                  >
                    <option value="">Grid default (Standard mix)</option>
                    <option value="REC">REC (100% Renewable)</option>
                    <option value="PPA">PPA (Power Purchase Agreement)</option>
                    <option value="GREEN_TARIFF">Green Tariff (Low carbon)</option>
                  </select>
                </label>
              )}
              {r.status === 'working' && <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Saving…</span>}
              {r.status === 'done' && (
                <span className="inline-icon" style={{ color: 'var(--color-success)', fontSize: 'var(--font-size-xs)' }}>
                  <Check size={14} aria-hidden="true" /> Saved
                </span>
              )}
              {r.status === 'error' && (
                <span style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)' }}>{r.error}</span>
              )}
            </div>
          </div>
        );
      })}

      <Button variant="secondary" icon={Plus} onClick={() => setRows((rs) => [...rs, newRow()])} disabled={busy}>Add another resource</Button>

      {profile?.departmentId && locations.length > 0 && (
        <FormField label="Location (optional, applied to every line)">
          <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">No specific location</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </FormField>
      )}

      <FormField label="Notes (optional, applied to every line)">
        <TextArea rows={2} maxLength={1000} placeholder="Anything the reviewer should know about this period" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormField>

      <div className="running-total" aria-live="polite">
        <div><p className="running-total__label">Lines</p><p className="running-total__value">{rows.length}</p></div>
        {Object.entries(totals.byUnit).map(([k, v]) => (
          <div key={k}><p className="running-total__label">{k}</p><p className="running-total__value">{fmtNumber(v, 2)}</p></div>
        ))}
        {totals.cost > 0 && <div><p className="running-total__label">Total cost</p><p className="running-total__value">${fmtNumber(totals.cost, 2)}</p></div>}
      </div>

      {issues.length > 0 && (
        <ul className="issue-list">{issues.map((i, k) => <li key={k}>{i.text}</li>)}</ul>
      )}
      {warnings.length > 0 && <div className="callout callout--warning">{warnings.map((w) => <div key={w}>{w}</div>)}</div>}

      {summary && (
        <div className={`callout ${summary.failed ? 'callout--danger' : 'callout--success'}`}>
          {summary.done} saved{summary.submitted ? ' and submitted' : ' as drafts'}{summary.failed ? `, ${summary.failed} failed — fix the highlighted lines and try again.` : '.'}{' '}
          <Link to={CONTRIBUTOR_ROUTES.HISTORY} className="inline-icon">View in history <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
      )}

      <div className="row-actions">
        <Button icon={Send} onClick={() => run(true)} disabled={!canSubmit} loading={busy}>Submit for review</Button>
        <Button variant="secondary" icon={Save} onClick={() => run(false)} disabled={!canSaveDrafts}>Save as drafts</Button>
      </div>
      {needsEvidence.length > 0 && blocking.length === 0 && (
        <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-3)' }}>
          You can save as drafts now and attach evidence later from Submission History.
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function CsvUpload() {
  const importCsv = useImportCsv();
  const { data: batches = [] } = useImportBatches();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [result, setResult] = useState(null);
  const [submittingAll, setSubmittingAll] = useState(false);

  const template = toCsv([
    ['resourceTypeName', 'quantity', 'unit', 'cost', 'periodStart', 'periodEnd', 'notes'],
    ['Electricity', '1200', 'kWh', '180', '2026-09-01', '2026-09-30', 'Main office'],
  ]);

  const upload = async () => {
    const problem = csvFileError(file);
    if (problem) { setFileError(problem); return; }
    const ok = await confirm({ title: `Import “${file.name}”?`, message: 'Valid rows are created as drafts in your department. Rows with problems are listed and skipped.', confirmLabel: 'Upload and validate', icon: Upload });
    if (!ok) return;
    try {
      const res = await importCsv.mutateAsync(file);
      setResult(res);
      setFile(null);
      showToast(`${res.batch.successRows} of ${res.batch.totalRows} rows imported as drafts.`, res.batch.errorRows ? 'info' : 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Upload failed.', 'error');
    }
  };

  const handleSubmitAll = async () => {
    if (!result?.createdRecordIds?.length) return;
    const count = result.createdRecordIds.length;
    const ok = await confirm({
      title: `Submit all ${count} entries for review?`,
      message: 'Each valid entry will be submitted to the Reviewer queue. Any entries requiring mandatory evidence attachments must have files attached before submission.',
      confirmLabel: 'Submit all for review',
      icon: Send,
    });
    if (!ok) return;
    setSubmittingAll(true);
    let successCount = 0;
    let failCount = 0;
    for (const id of result.createdRecordIds) {
      try {
        await resourceRecordsService.submit(id);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setSubmittingAll(false);
    qc.invalidateQueries({ queryKey: ['resource-records'] });
    if (failCount > 0) {
      showToast(`${successCount} submitted; ${failCount} require evidence attachment before submitting.`, 'info');
    } else {
      showToast(`All ${successCount} entries submitted for review!`, 'success');
    }
  };

  return (
    <div className="stack">
      <Card>
        <CardHeader
          icon={FileUp}
          title="Import from CSV"
          subtitle="Valid rows are created as drafts. Rows with problems are listed below and skipped — nothing is silently dropped."
          actions={<Button variant="secondary" size="sm" icon={Download} onClick={() => downloadText('tropos-usage-template.csv', template)}>Download template</Button>}
        />
        <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
          Columns: <code>resourceTypeName, quantity, unit, cost, periodStart, periodEnd, notes</code> (cost and notes optional). Max 5 MB and 1000 rows per file.
        </p>
        <ul className="text-muted" style={{ fontSize: 'var(--font-size-sm)', margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-5)' }}>
          <li><code>quantity</code> must be a positive plain number with up to 4 decimals (<code>1200</code>, <code>45.5</code>); <code>cost</code> up to 2 decimals. Both are capped at 1,000,000,000. Signs, thousands separators and scientific notation (<code>1e5</code>) are rejected.</li>
          <li>Dates must be written <code>YYYY-MM-DD</code> (for example <code>2026-09-30</code>). Formats like <code>5/1/2026</code> are rejected.</li>
          <li><code>unit</code> can be at most 30 characters and <code>notes</code> at most 1000.</li>
        </ul>
        <div style={{ margin: 'var(--space-4) 0' }}>
          {file ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--color-primary)' }}>
              <FileUp size={16} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>{file.name}</span>
              <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>({fmtNumber(file.size / 1024, 0)} KB)</span>
              <button
                type="button"
                title="Remove file"
                aria-label="Remove selected CSV file"
                onClick={() => { setFile(null); setFileError(null); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', padding: '2px' }}
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setFileError(f ? csvFileError(f) : null); }} />
          )}
          {fileError && <p className="form-field__error" role="alert">{fileError}</p>}
        </div>
        <Button icon={Upload} onClick={upload} disabled={!file || !!fileError} loading={importCsv.isPending}>Upload and validate</Button>

        {result && (
          <div style={{ marginTop: 'var(--space-5)' }}>
            <div className={`callout ${result.batch.errorRows ? 'callout--warning' : 'callout--success'}`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <div>
                  <strong>{result.batch.successRows} of {result.batch.totalRows} rows imported</strong> as drafts
                  {result.batch.errorRows ? `; ${result.batch.errorRows} need fixing.` : '.'}
                </div>
                {result.batch.successRows > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <Button
                      size="sm"
                      icon={Send}
                      onClick={handleSubmitAll}
                      loading={submittingAll}
                    >
                      Submit all ({result.batch.successRows}) for review
                    </Button>
                    <Link to={CONTRIBUTOR_ROUTES.HISTORY}>
                      <Button variant="secondary" size="sm" icon={ArrowRight}>
                        View in history
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Extracted Booking / Entry Details Table */}
            {result.importedRows && result.importedRows.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ClipboardList size={16} /> Extracted Booking Details ({result.importedRows.length} entries taken)
                </h4>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Resource</th>
                        <th className="num">Quantity</th>
                        <th>Period</th>
                        <th className="num">Cost</th>
                        <th>Notes / Booking Ref</th>
                        <th>Staged As</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.importedRows.map((r) => (
                        <tr key={r.row}>
                          <td><strong>#{r.row}</strong></td>
                          <td><strong>{r.resourceTypeName}</strong></td>
                          <td className="num">{fmtNumber(r.quantity, 2)} {r.unit}</td>
                          <td>{fmtRange(r.periodStart, r.periodEnd)}</td>
                          <td className="num">{r.cost != null ? `$${fmtNumber(r.cost, 2)}` : '—'}</td>
                          <td className="text-muted" style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.notes || '—'}
                          </td>
                          <td>
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)', fontWeight: 500 }}>
                              Draft Staged
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Skipped rows / errors if any */}
            {result.batch.errorsJson?.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <h4 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-danger)' }}>
                  Skipped Rows ({result.batch.errorsJson.length})
                </h4>
                <table className="data-table">
                  <thead><tr><th>Row</th><th>Problem</th></tr></thead>
                  <tbody>
                    {result.batch.errorsJson.map((e) => (
                      <tr key={e.row}><td><strong>#{e.row}</strong></td><td>{e.errors.join('; ')}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      {batches.length > 0 && (
        <Card padded={false}>
          <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}><CardHeader icon={History} title="Past imports" /></div>
          <table className="data-table">
            <thead><tr><th>File</th><th>When</th><th className="num">Rows</th><th className="num">Imported</th><th className="num">Errors</th></tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}><td>{b.fileName}</td><td>{fmtDateTime(b.createdAt)}</td><td className="num">{b.totalRows}</td><td className="num">{b.successRows}</td><td className="num">{b.errorRows}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
