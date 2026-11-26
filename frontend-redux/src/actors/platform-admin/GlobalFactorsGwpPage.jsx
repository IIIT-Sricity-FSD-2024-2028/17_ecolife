import React, { useRef } from 'react';
import { unitName } from '../../utils/labels';
import { useDispatch } from 'react-redux';
import { Download, Upload } from 'lucide-react';
import { getResource } from '../../store/resourceSlice';
import { useAction } from '../../hooks/useAction';
import { useForm } from '../../hooks/useForm';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDialog, Dialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, Notice, PageHeader, SelectField, StatusBadge, TextField } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { fmtDate, fmtNum } from '../../utils/formatters';
import { useOptions, toOptions } from '../../hooks/useOptions';

const COLS = ['code', 'name', 'domain', 'scope', 'tier', 'regimeTag', 'region', 'sourceAuthority', 'versionLabel', 'validFrom', 'validTo', 'canonicalUnit', 'co2KgPerUnit', 'ch4KgPerUnit', 'n2oKgPerUnit'];
const NUM = ['co2KgPerUnit', 'ch4KgPerUnit', 'n2oKgPerUnit'];
const ST = { PUBLISHED: 'In use', PENDING_APPROVAL: 'Waiting for approval', REJECTED: 'Rejected', APPROVED: 'In use', SUPERSEDED: 'Replaced' };

/** Reads quoted CSV. Returns an array of row objects keyed by the header names. */
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some((x) => x !== '')) rows.push(row); row = []; cell = ''; } else cell += c;
  }
  row.push(cell); if (row.some((x) => x !== '')) rows.push(row);
  const head = (rows.shift() || []).map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
const toFactor = (r) => Object.fromEntries(COLS.filter((k) => r[k] !== undefined && r[k] !== '').map((k) => [k, NUM.includes(k) ? Number(r[k]) : r[k]]));

function ReleaseDialog({ open, onClose, onDone }) {
  const { pushToast } = useToast();
  const dispatch = useDispatch();
  const f = useForm('factor-release-dialog', { rows: null, name: '', check: null, busy: '' });
  const { rows, name, check, busy } = f.values;
  const input = useRef(null);
  const template = () => { const blob = new Blob([`${COLS.join(',')}\n`], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'emission-factor-release-template.csv'; a.click(); };
  async function pick(e) { const file = e.target.files?.[0]; f.set('check', null); if (!file) return; f.patch({ name: file.name, rows: parseCsv(await file.text()).map(toFactor) }); }
  async function send(dryRun) {
    f.set('busy', dryRun ? 'check' : 'send');
    // read the whole outcome here (not just success): a refusal must always be shown in the dialog, never read as a pass
    const out = await dispatch(getResource('platform').send({ path: '/platform/factor-releases', method: 'POST', body: { dryRun, factors: rows }, silent: true }));
    if (out.error) {
      const p = out.payload || {};
      const d = p.details && typeof p.details === 'object' ? Object.entries(p.details).flatMap(([k, v]) => [].concat(v).map((m) => `${k}: ${m}`)) : [];
      f.set('check', { errors: (d.length ? d : [p.message || 'The release was refused.']).map((message) => ({ row: 0, message })) });
    } else {
      const r = out.payload; f.set('check', r);
      if (!dryRun && r.stored) { pushToast('Release sent. A second administrator must approve it.'); onDone(); onClose(); }
    }
    f.set('busy', '');
  }
  const errs = check?.errors || [];
  return (
    <Dialog open={open} onClose={onClose} wide title="Propose a factor release" description="Upload the new or updated factors as a spreadsheet (CSV). Nothing reaches customers until a different administrator approves.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2"><input ref={input} type="file" accept=".csv" onChange={pick} className="text-sm file:mr-3 file:h-10 file:px-3 file:rounded-md file:border file:border-line-strong file:bg-white file:text-sm" aria-label="Release file" /><Button variant="secondary" size="sm" onClick={template}><Download className="w-3.5 h-3.5" /> Template</Button></div>
        {rows && <p className="text-sm text-muted">{name}: {rows.length} rows read.</p>}
        {check && (errs.length === 0 ? <Notice tone="ok">All {check.summary?.rows} rows pass. {check.summary?.newCodes} new, {check.summary?.replacesCurrent} replace a factor now in use.{check.stored ? '' : ' Nothing is saved yet.'}</Notice> : <Notice tone="warn" className="flex-col"><div className="font-medium mb-1">{errs.length} problems. Nothing was saved.</div><ul className="list-disc pl-5 max-h-48 overflow-auto">{errs.slice(0, 30).map((e, i) => <li key={i}>{e.row ? `Row ${e.row}${e.code ? ` (${e.code})` : ''}: ` : ''}{e.message}</li>)}</ul></Notice>)}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Close</Button><Button variant="secondary" disabled={!rows?.length} loading={busy === 'check'} onClick={() => send(true)}>Check the file</Button><Button disabled={!rows?.length || !check || errs.length > 0 || check.stored === false && check.dryRun !== true} loading={busy === 'send'} onClick={() => send(false)}><Upload className="w-4 h-4" /> Send for approval</Button></div>
      </div>
    </Dialog>
  );
}

export default function GlobalFactorsGwpPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const send = useAction();
  const dialog = useDialog();
  const { enums } = useOptions();
  const { data: rel, refetch: refRel } = useApi('/platform/factor-releases');
  const { data: gwp } = useApi('/platform/gwp-table');
  const page = useForm('global-factors', { tab: 'library', q: '', domain: '', status: '', dlg: false });
  const { tab, q, domain, status, dlg } = page.values;
  const setTab = (v) => page.set('tab', v);
  const setQ = (v) => page.set('q', v);
  const setDomain = (v) => page.set('domain', v);
  const setStatus = (v) => page.set('status', v);
  const setDlg = (v) => page.set('dlg', v);

  async function decide(g, decision) {
    let note;
    if (decision === 'REJECT') { const v = await dialog.form({ title: `Reject release ${g.versionLabel}`, danger: true, submitLabel: 'Reject release', fields: [{ name: 'note', type: 'textarea', label: 'Why?', required: true, minLength: 5 }] }); if (!v) return; note = v.note; }
    else if (!(await dialog.confirm({ title: `Publish release ${g.versionLabel}?`, message: `${g.count} factors go live for every company. Earlier versions of the same codes end the day the new ones start.`, confirmLabel: 'Publish' }))) return;
    await send({ path: '/platform/factor-releases/decide', method: 'POST', body: { versionLabel: g.versionLabel, proposedById: g.proposedById, decision, note }, toast: decision === 'APPROVE' ? 'Published.' : 'Rejected.' });
  }
  const TABS = [['library', 'Library'], ['releases', `Waiting for approval${rel?.length ? ` (${rel.length})` : ''}`], ['gwp', 'Gas warming values']];
  return (
    <div>
      <PageHeader title="Emission factor library" description="The official factors every company calculates with." actions={<Button onClick={() => setDlg(true)}><Upload className="w-4 h-4" /> Propose a release</Button>} />
      <div role="tablist" className="flex flex-wrap gap-1.5 mb-4">{TABS.map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`h-9 px-3.5 rounded-md text-sm font-medium border ${tab === id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-text border-line-strong hover:bg-brand-50'}`}>{l}</button>)}</div>
      {tab === 'library' && <DataGrid endpoint="/platform/factors" params={{ q, domain, status }} exportName="factor-library"
        toolbar={<><TextField className="w-56" label="" aria-label="Search" placeholder="Code, name or source" value={q} onChange={setQ} /><SelectField className="w-44" label="" aria-label="Type" value={domain} onChange={setDomain} placeholder="All types" options={toOptions(enums.ResourceDomain)} /><SelectField className="w-48" label="" aria-label="Status" value={status} onChange={setStatus} placeholder="Any status" options={Object.entries(ST).map(([v, l]) => ({ value: v, label: l }))} /></>}
        columns={[{ key: 'c', label: 'Factor', render: (r) => <><div className="font-medium">{r.name}</div><div className="text-xs text-muted">{r.code} · {r.versionLabel} · {r.sourceAuthority}</div></>, value: (r) => r.code },
          { key: 'v', label: 'CO₂ per unit (kg)', numeric: true, render: (r) => (Number(r.co2KgPerUnit) === 0 ? <span className="text-muted">No CO₂, other gases only</span> : `${fmtNum(r.co2KgPerUnit, 4)} / ${unitName(r.canonicalUnit)}`), value: (r) => r.co2KgPerUnit }, { key: 'f', label: 'Valid', hideOnMobile: true, render: (r) => `${fmtDate(r.validFrom)} to ${r.validTo ? fmtDate(r.validTo) : 'now'}`, value: (r) => r.validFrom },
          { key: 's', label: 'Status', render: (r) => <StatusBadge status={r.status === 'PUBLISHED' ? 'ACTIVE' : r.status} label={ST[r.status] || r.status} />, value: (r) => r.status }]}
        emptyTitle="No factors match" emptyText="Try a shorter search." />}
      {tab === 'releases' && (!rel ? <div className="h-24 animate-pulse" /> : rel.length === 0 ? <Card><EmptyState title="No release is waiting">When someone proposes new factors, they appear here for a second administrator.</EmptyState></Card> : (
        <div className="space-y-4">{rel.map((g) => { const mine = g.proposedById === user?.userId; return (
          <Card key={`${g.versionLabel}${g.proposedById}`} title={`Release ${g.versionLabel}`} description={`${g.count} factors · ${g.sourceAuthority} · proposed ${fmtDate(g.proposedAt)}`} actions={mine ? <span className="text-sm text-muted">You proposed this. Another administrator must decide.</span> : <div className="flex gap-2"><Button size="sm" onClick={() => decide(g, 'APPROVE')}>Publish</Button><Button size="sm" variant="secondary" onClick={() => decide(g, 'REJECT')}>Reject</Button></div>} padded={false}>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted border-b border-line"><th className="px-5 py-2 font-medium">Factor</th><th className="font-medium text-right">CO₂ per unit (kg)</th><th className="px-5 font-medium text-right">From</th></tr></thead><tbody>{g.factors.slice(0, 15).map((f) => <tr key={f.code} className="border-b border-line last:border-0"><td className="px-5 py-2"><span className="font-medium">{f.name}</span> <span className="text-xs text-muted">{f.code}</span></td><td className="text-right tabular-nums">{fmtNum(f.co2KgPerUnit, 4)} / {unitName(f.canonicalUnit)}</td><td className="px-5 text-right">{fmtDate(f.validFrom)}</td></tr>)}</tbody></table></div>
            {g.count > 15 && <p className="px-5 py-2 text-sm text-muted">…and {g.count - 15} more.</p>}
          </Card>); })}</div>))}
      {tab === 'gwp' && <Card padded={false}>{!gwp ? <div className="h-16 animate-pulse" /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted border-b border-line"><th className="px-5 py-2.5 font-medium">Gas</th><th className="font-medium text-right">AR6 (used for reports)</th><th className="font-medium text-right">AR5</th><th className="px-5 font-medium text-right">AR2 (carbon market)</th></tr></thead><tbody>{gwp.map((g) => <tr key={g.gasCode} className="border-b border-line last:border-0"><td className="px-5 py-2.5"><span className="font-medium">{g.gasName}</span> <span className="text-xs text-muted">{g.gasCode}</span></td><td className="text-right tabular-nums">{fmtNum(g.gwpAr6, 1)}</td><td className="text-right tabular-nums">{fmtNum(g.gwpAr5, 1)}</td><td className="px-5 text-right tabular-nums">{fmtNum(g.gwpAr2, 1)}</td></tr>)}</tbody></table></div>}</Card>}
      <ReleaseDialog open={dlg} onClose={() => setDlg(false)} onDone={() => { refRel(); setTab('releases'); }} />
    </div>
  );
}
