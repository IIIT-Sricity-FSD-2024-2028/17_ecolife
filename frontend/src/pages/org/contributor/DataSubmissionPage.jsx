import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PencilLine, FileUp, Plus, Trash2, Send, Save, Download, Upload, Check, History, ClipboardList, ArrowRight } from 'lucide-react';
import { Card, CardHeader } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { Button } from '../../../components/ui/Button';
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
import { downloadText, fmtDateTime, fmtNumber, isoToday, toCsv } from '../../../utils/format';

let rowSeq = 1;
const newRow = () => ({ key: rowSeq++, resourceTypeId: '', quantity: '', unit: '', cost: '', file: null, status: 'idle', error: null });

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
    });
    return out;
  }, [rows, period, notes, typeById]);

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

      <div className="split-2">
        <FormField label="Period start" required>
          <TextInput type="date" max={isoToday()} value={period.start} onChange={(e) => setPeriod((p) => ({ ...p, start: e.target.value }))} />
        </FormField>
        <FormField label="Period end" required>
          <TextInput type="date" value={period.end} onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.value }))} />
        </FormField>
      </div>

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
                {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
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

            {(needs || r.status !== 'idle') && (
              <div className="entry-row__extra">
                {needs && r.status !== 'done' && (
                  <label>
                    <strong>Evidence required</strong> (above {fmtNumber(t.evidenceThreshold)} {r.unit}):{' '}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.csv,.xls,.xlsx" onChange={(e) => patch(r.key, { file: e.target.files?.[0] ?? null })} />
                  </label>
                )}
                {r.status === 'working' && <span className="text-muted">Saving…</span>}
                {r.status === 'done' && <span className="inline-icon" style={{ color: 'var(--color-success)' }}><Check size={14} aria-hidden="true" /> Saved</span>}
                {r.status === 'error' && <span style={{ color: 'var(--color-danger)' }}>{r.error}</span>}
              </div>
            )}
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
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [result, setResult] = useState(null);

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
          Columns: <code>resourceTypeName, quantity, unit, cost, periodStart, periodEnd, notes</code> (cost and notes optional, dates as YYYY-MM-DD). Max 5 MB.
        </p>
        <div style={{ margin: 'var(--space-4) 0' }}>
          <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setFileError(f ? csvFileError(f) : null); }} />
          {fileError && <p className="form-field__error" role="alert">{fileError}</p>}
        </div>
        <Button icon={Upload} onClick={upload} disabled={!file || !!fileError} loading={importCsv.isPending}>Upload and validate</Button>

        {result && (
          <div style={{ marginTop: 'var(--space-5)' }}>
            <div className={`callout ${result.batch.errorRows ? 'callout--warning' : 'callout--success'}`}>
              {result.batch.successRows} of {result.batch.totalRows} rows imported as drafts
              {result.batch.errorRows ? `; ${result.batch.errorRows} need fixing.` : '.'}{' '}
              <Link to={CONTRIBUTOR_ROUTES.HISTORY} className="inline-icon">Review and submit them <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
            {result.batch.errorsJson?.length > 0 && (
              <table className="data-table">
                <thead><tr><th>Row</th><th>Problem</th></tr></thead>
                <tbody>
                  {result.batch.errorsJson.map((e) => (
                    <tr key={e.row}><td>{e.row}</td><td>{e.errors.join('; ')}</td></tr>
                  ))}
                </tbody>
              </table>
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

