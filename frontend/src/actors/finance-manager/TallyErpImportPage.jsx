import React, { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { downloadFile } from '../../services/downloadService';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, Notice, PageHeader, SelectField, StatusBadge } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { fmtDate } from '../../utils/formatters';

const CHANNEL = { TALLY_ERP: 'Export from TallyPrime', CSV_EXCEL: 'Tropos spreadsheet' };
const BATCH = { PREVIEW: 'Checked only', COMMITTED: 'Imported', ROLLED_BACK: 'Undone' };

export default function TallyErpImportPage() {
  const { pushToast } = useToast();
  const dialog = useDialog();
  const { data: periods } = useApi('/periods');
  const [periodId, setPeriodId] = useState('');
  const [channel, setChannel] = useState('TALLY_ERP');
  const [file, setFile] = useState(null);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState('');
  const [tick, setTick] = useState(0);
  const input = useRef(null);
  const open = (periods || []).filter((p) => ['OPEN', 'REOPENED'].includes(p.status));
  const pid = periodId || open[0]?.id || '';

  async function run(commit) {
    if (!file || !pid) return;
    setBusy(commit ? 'commit' : 'check');
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('periodId', pid); fd.append('channel', channel); fd.append('commit', String(commit));
      const r = await apiFetch('/imports/csv', { method: 'POST', body: fd });
      setRes({ ...r, committedNow: commit });
      if (commit && r.committed) { pushToast(`${r.inserted} rows imported as drafts.`); setFile(null); if (input.current) input.current.value = ''; } else if (commit) pushToast('Nothing was imported. Fix the rows below first.', 'error'); else pushToast(r.errors.length ? `${r.errors.length} rows need fixing.` : 'All rows look good. You can import now.');
      setTick((t) => t + 1);
    } catch (e) { pushToast(e.message, 'error'); } finally { setBusy(''); }
  }
  async function undo(b) {
    if (!(await dialog.confirm({ title: 'Undo this import?', message: 'Drafts from this file are withdrawn. Entries already submitted or approved stay.', confirmLabel: 'Undo import', danger: true }))) return;
    try { const r = await apiFetch(`/imports/batches/${b.id}/rollback`, { method: 'POST' }); pushToast(`Undone. ${r.withdrawnDraftEntries} drafts withdrawn.`); setTick((t) => t + 1); } catch (e) { pushToast(e.message, 'error'); }
  }

  const errs = res?.errors || [];
  return (
    <div>
      <PageHeader title="Import data" description="Bring in many rows at once from TallyPrime or a spreadsheet." actions={<div className="flex gap-2"><Button variant="secondary" onClick={() => downloadFile('/imports/template?type=tally', 'tropos_tally_template.csv')}><Download className="w-4 h-4" /> Tally template</Button><Button variant="secondary" onClick={() => downloadFile('/imports/template?type=standard', 'tropos_template.csv')}><Download className="w-4 h-4" /> Spreadsheet template</Button></div>} />
      <Card title="Import a file" description="Check first. Nothing is saved until you press Import. Rows come in as drafts and still go through review." className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3 items-end">
          <SelectField label="Month" value={pid} onChange={setPeriodId} options={open.map((p) => ({ value: p.id, label: p.label }))} />
          <SelectField label="Where is the file from?" value={channel} onChange={setChannel} options={Object.entries(CHANNEL).map(([v, l]) => ({ value: v, label: l }))} />
          <div><label className="text-sm font-medium block mb-1.5" htmlFor="imp-file">File (.csv)</label><input id="imp-file" ref={input} type="file" accept=".csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setRes(null); }} className="block w-full text-sm file:mr-3 file:h-10 file:px-3 file:rounded-md file:border file:border-line-strong file:bg-white file:text-sm" /></div>
        </div>
        <div className="flex gap-2 mt-4"><Button variant="secondary" disabled={!file || !pid} loading={busy === 'check'} onClick={() => run(false)}>Check the file</Button><Button disabled={!file || !pid} loading={busy === 'commit'} onClick={() => run(true)}><Upload className="w-4 h-4" /> Import</Button></div>
        {res && <div className="mt-4">{errs.length === 0 ? <Notice tone="ok">{res.committed ? `${res.inserted} rows imported as drafts.` : `All ${res.batch?.totalRows ?? ''} rows look good.`}</Notice> : (
          <Notice tone="warn" className="flex-col"><div className="font-medium mb-1">{errs.length} rows need fixing. Nothing was imported.</div><ul className="list-disc pl-5 space-y-0.5">{errs.slice(0, 10).map((e, i) => <li key={i}>Row {e.row}: {e.reason}</li>)}</ul>{errs.length > 10 && <div className="mt-1">…and {errs.length - 10} more.</div>}</Notice>)}</div>}
      </Card>
      <DataGrid endpoint="/imports/batches" refreshKey={tick} exportName="imports" initialPageSize={10}
        columns={[{ key: 'f', label: 'File', render: (r) => <><div className="font-medium">{r.fileName}</div><div className="text-xs text-muted">{r.period?.label} · {CHANNEL[r.channel] || r.channel}</div></>, value: (r) => r.fileName },
          { key: 'v', label: 'Good rows / all rows', numeric: true, render: (r) => `${r.validRows} / ${r.totalRows}`, value: (r) => r.validRows }, { key: 'e', label: 'Rows to fix', numeric: true, render: (r) => r.errorRows, value: (r) => r.errorRows },
          { key: 's', label: 'Status', render: (r) => <StatusBadge status={r.status} label={BATCH[r.status]} />, value: (r) => r.status }, { key: 'd', label: 'Date', hideOnMobile: true, render: (r) => fmtDate(r.createdAt), value: (r) => r.createdAt },
          { key: 'a', label: '', render: (r) => r.status === 'COMMITTED' ? <Button size="sm" variant="secondary" onClick={() => undo(r)}>Undo</Button> : null }]}
        emptyTitle="No imports yet" emptyText="Imports you make are listed here, and each can be undone." />
    </div>
  );
}
