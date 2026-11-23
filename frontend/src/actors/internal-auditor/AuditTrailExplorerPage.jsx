import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import { Button, Notice, PageHeader, StatusBadge, TextField } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { fmtDate } from '../../utils/formatters';

const words = (s) => String(s || '').toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const day = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AuditTrailExplorerPage() {
  const { pushToast } = useToast();
  const [tab, setTab] = useState('log');
  const [q, setQ] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [eq, setEq] = useState('');

  async function check(r) {
    try { const x = await apiFetch(`/evidence/${r.id}/verify-integrity`); pushToast(x.intact ? 'File is unchanged since it was uploaded.' : `Warning: ${x.reason || 'the file no longer matches what was uploaded'}.`, x.intact ? 'success' : 'error'); }
    catch (e) { pushToast(e.message, 'error'); }
  }

  return (
    <div>
      <PageHeader title="Activity log" description="Everything that was done in this workspace, and the evidence behind the figures. Nothing here can be edited or deleted." />
      <div role="tablist" className="flex gap-1.5 mb-4">{[['log', 'Activity'], ['evidence', 'Evidence files']].map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`h-9 px-3.5 rounded-md text-sm font-medium border ${tab === id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-text border-line-strong hover:bg-brand-50'}`}>{l}</button>)}</div>
      {tab === 'log' ? (
        <DataGrid endpoint="/audit-logs" params={{ q, from, to }} exportName="activity-log" initialPageSize={50}
          toolbar={<><TextField className="w-60" label="" aria-label="Search" placeholder="Search what was done" value={q} onChange={setQ} /><TextField className="w-40" label="" aria-label="From" type="date" value={from} onChange={setFrom} /><TextField className="w-40" label="" aria-label="To" type="date" value={to} onChange={setTo} /></>}
          columns={[{ key: 'd', label: 'When', render: (r) => day(r.createdAt), value: (r) => r.createdAt }, { key: 'w', label: 'Who', render: (r) => r.actorName || <span className="text-muted">System</span>, value: (r) => r.actorName },
            { key: 'a', label: 'What', render: (r) => <span className="font-medium">{words(r.action)}</span>, value: (r) => r.action }, { key: 'r', label: 'On', hideOnMobile: true, render: (r) => words(r.resourceType), value: (r) => r.resourceType }]}
          emptyTitle="Nothing matches" emptyText="Try a wider date range or a shorter search." />
      ) : (<>
        <Notice tone="info" className="mb-4">Each file has a fingerprint taken when it was uploaded. “Check file” re-reads it and confirms it is unchanged.</Notice>
        <DataGrid endpoint="/evidence" params={{ q: eq }} exportName="evidence-files"
          toolbar={<TextField className="w-60" label="" aria-label="Search files" placeholder="Search by file name" value={eq} onChange={setEq} />}
          columns={[{ key: 'f', label: 'File', render: (r) => <span className="font-medium">{r.fileName}</span>, value: (r) => r.fileName }, { key: 'u', label: 'Uploaded', hideOnMobile: true, render: (r) => fmtDate(r.uploadedAt), value: (r) => r.uploadedAt },
            { key: 'h', label: 'Fingerprint', hideOnMobile: true, render: (r) => <code className="text-xs">{r.fileSha256?.slice(0, 16)}…</code>, value: (r) => r.fileSha256 }, { key: 'l', label: 'State', render: (r) => <StatusBadge status={r.isLocked ? 'ACTIVE' : 'PENDING'} label={r.isLocked ? 'Locked' : 'Can change'} />, value: (r) => (r.isLocked ? 'Locked' : 'Open') },
            { key: 'c', label: '', render: (r) => <Button size="sm" variant="secondary" onClick={() => check(r)}><ShieldCheck className="w-3.5 h-3.5" /> Check file</Button> }]}
          emptyTitle="No evidence files" emptyText="Invoices and certificates attached to entries appear here." />
      </>)}
    </div>
  );
}
