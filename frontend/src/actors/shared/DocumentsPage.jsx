import React, { useRef, useState } from 'react';
import { Download, ShieldCheck, Upload } from 'lucide-react';
import { apiDownload, apiFetch } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Notice, PageHeader, TextField } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { fmtDate } from '../../utils/formatters';

const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Bills, certificates and slips that back up your numbers. Each file gets a fingerprint so tampering can be detected. */
export default function DocumentsPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const input = useRef(null);
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const canUpload = (user?.roles || []).some((r) => ['PLANT_MANAGER', 'SUSTAINABILITY_LEAD', 'FINANCE_MANAGER'].includes(r));

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    try { const fd = new FormData(); fd.append('file', file); await apiFetch('/evidence/upload', { method: 'POST', body: fd }); pushToast('Document saved.'); setTick((t) => t + 1); }
    catch (e) { pushToast(e.message, 'error'); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  async function check(r) {
    try { const x = await apiFetch(`/evidence/${r.id}/verify-integrity`); pushToast(x.intact ? `${r.fileName} is unchanged since it was uploaded.` : `${r.fileName} does not match its fingerprint. ${x.reason || ''}`, x.intact ? 'success' : 'error'); }
    catch (e) { pushToast(e.message, 'error'); }
  }
  const columns = [
    { key: 'fileName', label: 'File', render: (r) => <span className="font-medium">{r.fileName}</span>, value: (r) => r.fileName },
    { key: 'sizeBytes', label: 'Size', numeric: true, render: (r) => size(r.sizeBytes), value: (r) => r.sizeBytes },
    { key: 'uploadedAt', label: 'Added', render: (r) => fmtDate(r.uploadedAt), value: (r) => r.uploadedAt },
    { key: 'link', label: 'Used for', render: (r) => (r.entryId ? 'An energy or fuel record' : <span className="text-subtle">Not linked yet</span>), value: (r) => (r.entryId ? 'Linked' : 'Not linked') },
    { key: 'a', label: '', render: (r) => <div className="flex gap-1.5 justify-end"><Button size="sm" variant="secondary" onClick={() => apiDownload(`/evidence/${r.id}/download`, r.fileName).catch((e) => pushToast(e.message, 'error'))}><Download className="w-4 h-4" /> Download</Button><Button size="sm" variant="ghost" onClick={() => check(r)}><ShieldCheck className="w-4 h-4" /> Check</Button></div> }
  ];
  return (
    <div>
      <PageHeader title="Documents" description="Keep the bills, lab certificates and weighbridge slips that back up your numbers. Auditors can ask for these."
        actions={canUpload && <><input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.csv" className="sr-only" aria-label="Choose a document" onChange={(e) => upload(e.target.files?.[0])} /><Button loading={busy} onClick={() => input.current?.click()}><Upload className="w-4 h-4" /> Add a document</Button></>} />
      <Notice className="mb-4">PDF, PNG, JPEG or CSV, up to 10 MB each. A “Check” compares the stored file with its fingerprint from the day it was added.</Notice>
      <DataGrid endpoint="/evidence" params={{ q }} refreshKey={tick} columns={columns} exportName="documents" toolbar={<TextField className="w-64" label="" aria-label="Search by file name" placeholder="Search by file name" value={q} onChange={setQ} />}
        emptyTitle={q ? 'No document matches that name' : 'No documents yet'} emptyText={q ? 'Try a shorter part of the file name.' : 'Add your first bill or certificate. You can also attach one while entering a record.'} />
    </div>
  );
}
