import React, { useEffect, useMemo, useState } from 'react';
import { CheckCheck, TriangleAlert } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Notice, PageHeader } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { fmtDate, fmtInr, fmtNum } from '../../utils/formatters';
import { describeFlag, isAnomaly, WASTE_CATEGORY, WASTE_ROUTE, WATER_SOURCE } from '../../utils/labels';
import { useOptions, toOptions } from '../../hooks/useOptions';

const site = (r) => r.facility?.name || r.source?.facility?.name || '';
const month = (r) => r.period?.label || '';
const Flags = ({ r }) => { const f = (r.qualityFlags || []).filter(isAnomaly); return f.length ? <span className="inline-flex items-start gap-1.5 text-saffron-600 text-sm"><TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />{f.map(describeFlag).join('; ')}</span> : <span className="text-subtle">None</span>; };

const KINDS = [
  { id: 'energy', label: 'Energy and fuel', endpoint: '/entries', path: (id) => `/entries/${id}`, cols: () => [
    { key: 's', label: 'Meter or source', render: (r) => <><div className="font-medium">{r.source?.name}</div><div className="text-xs text-muted">{site(r)} · {month(r)}</div></> , value: (r) => r.source?.name },
    { key: 'q', label: 'Amount', numeric: true, render: (r) => `${fmtNum(r.normalizedQuantity)} ${r.normalizedUnit}`, value: (r) => `${r.normalizedQuantity} ${r.normalizedUnit}` },
    { key: 'e', label: 'Emissions (tCO₂e)', numeric: true, render: (r) => fmtNum(r.calculatedTco2eAr6, 3), value: (r) => r.calculatedTco2eAr6 },
    { key: 'c', label: 'Cost (₹)', numeric: true, render: (r) => (r.costInr ? fmtInr(r.costInr) : '—'), value: (r) => r.costInr },
    { key: 'f', label: 'Automatic checks', render: (r) => <Flags r={r} />, value: (r) => (r.qualityFlags || []).map(describeFlag).join('; ') }] },
  { id: 'water', label: 'Water', endpoint: '/resources/water', path: (id) => `/resources/water/${id}`, cols: () => [
    { key: 's', label: 'Site and month', render: (r) => <><div className="font-medium">{site(r)}</div><div className="text-xs text-muted">{month(r)}</div></>, value: (r) => `${site(r)} ${month(r)}` },
    { key: 'src', label: 'Source', render: (r) => WATER_SOURCE[r.withdrawalSource] || r.withdrawalSource },
    { key: 'w', label: 'Taken (kL)', numeric: true, render: (r) => fmtNum(r.withdrawalKl), value: (r) => r.withdrawalKl },
    { key: 'd', label: 'Discharged (kL)', numeric: true, render: (r) => fmtNum(r.dischargeKl), value: (r) => r.dischargeKl },
    { key: 'u', label: 'Used up (kL)', numeric: true, render: (r) => fmtNum(r.consumptionKl), value: (r) => r.consumptionKl }] },
  { id: 'waste', label: 'Waste', endpoint: '/resources/waste', path: (id) => `/resources/waste/${id}`, cols: () => [
    { key: 's', label: 'Site and month', render: (r) => <><div className="font-medium">{site(r)}</div><div className="text-xs text-muted">{month(r)}</div></>, value: (r) => `${site(r)} ${month(r)}` },
    { key: 't', label: 'Type', render: (r) => WASTE_CATEGORY[r.wasteCategory] || r.wasteCategory },
    { key: 'r', label: 'What happened', render: (r) => WASTE_ROUTE[r.treatmentRoute] || r.treatmentRoute },
    { key: 'q', label: 'Weight (tonnes)', numeric: true, render: (r) => fmtNum(r.quantityMt, 3), value: (r) => r.quantityMt }] },
  { id: 'air', label: 'Air', endpoint: '/resources/air-emissions', path: (id) => `/resources/air-emissions/${id}`, cols: () => [
    { key: 's', label: 'Site and month', render: (r) => <><div className="font-medium">{site(r)}</div><div className="text-xs text-muted">{month(r)}</div></>, value: (r) => `${site(r)} ${month(r)}` },
    { key: 'p', label: 'Pollutant', render: (r) => String(r.pollutant).replace(/_/g, ' ') },
    { key: 'q', label: 'Released (kg)', numeric: true, render: (r) => fmtNum(r.quantityKg, 3), value: (r) => r.quantityKg },
    { key: 'l', label: 'Legal limit (kg)', numeric: true, render: (r) => (r.spcbLimitKg ? fmtNum(r.spcbLimitKg, 3) : '—'), value: (r) => r.spcbLimitKg }] },
  { id: 'materials', label: 'Materials', endpoint: '/resources/materials', path: (id) => `/resources/materials/${id}`, cols: () => [
    { key: 's', label: 'Site and month', render: (r) => <><div className="font-medium">{site(r)}</div><div className="text-xs text-muted">{month(r)}</div></>, value: (r) => `${site(r)} ${month(r)}` },
    { key: 'm', label: 'Material', render: (r) => r.materialName },
    { key: 'q', label: 'Weight (tonnes)', numeric: true, render: (r) => fmtNum(r.quantityMt, 3), value: (r) => r.quantityMt }] }
];

/** Everything people have sent for review, in one place. Approve in a click or send back with a reason. */
export default function ReviewQueuePage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const dialog = useDialog();
  const [tab, setTab] = useState('energy');
  const [counts, setCounts] = useState({});
  const [tick, setTick] = useState(0);
  const kind = KINDS.find((k) => k.id === tab);
  const canReview = (user?.roles || []).some((r) => ['SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER'].includes(r));

  useEffect(() => {
    KINDS.forEach((k) => apiFetch(`${k.endpoint}?page=1&pageSize=1&status=SUBMITTED`).then((r) => setCounts((c) => ({ ...c, [k.id]: r.total }))).catch(() => {}));
  }, [tick]);
  useEffect(() => { const first = KINDS.find((k) => counts[k.id] > 0); if (first && !counts._picked && counts[tab] === 0) setTab(first.id); }, [counts]); // eslint-disable-line

  async function decide(row, decision) {
    let body = { decision };
    if (decision === 'REJECTED') {
      const v = await dialog.form({ title: 'Send back for correction', description: 'The person who entered this will see your note, fix it and send it again.', submitLabel: 'Send back', danger: true,
        fields: [{ name: 'note', type: 'textarea', label: 'What needs fixing?', placeholder: 'e.g. The bill number does not match the picture. Please check and resend.', required: true, minLength: 5 }] });
      if (!v) return; body = { decision, reviewNote: v.note.trim() };
    }
    try { await apiFetch(`${kind.path(row.id)}/review`, { method: 'POST', body: JSON.stringify(body) }); pushToast(decision === 'APPROVED' ? 'Approved.' : 'Sent back.'); setTick((t) => t + 1); }
    catch (e) { pushToast(e.message, 'error'); }
  }

  const columns = useMemo(() => [...kind.cols(), { key: 'a', label: '', render: (r) => canReview ? <div className="flex gap-1.5 justify-end"><Button size="sm" onClick={() => decide(r, 'APPROVED')}>Approve</Button><Button size="sm" variant="secondary" onClick={() => decide(r, 'REJECTED')}>Send back</Button></div> : null }], [kind, canReview]); // eslint-disable-line
  const total = Object.entries(counts).reduce((s, [k, v]) => (k.startsWith('_') ? s : s + v), 0);

  return (
    <div>
      <PageHeader title="Review" description={total ? `${total} ${total === 1 ? 'record is' : 'records are'} waiting for you.` : 'Everything sent for review shows up here.'} />
      {!canReview && <Notice tone="warn" className="mb-4">Only a sustainability lead or an executive approver can approve records. You can look at the list.</Notice>}
      <div role="tablist" className="flex flex-wrap gap-1.5 mb-4">
        {KINDS.map((k) => <button key={k.id} role="tab" aria-selected={tab === k.id} onClick={() => setTab(k.id)} className={`h-9 px-3.5 rounded-md text-sm font-medium border inline-flex items-center gap-2 ${tab === k.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-text border-line-strong hover:bg-brand-50'}`}>{k.label}{counts[k.id] > 0 && <span className={`text-xs rounded-full px-1.5 ${tab === k.id ? 'bg-white/25' : 'bg-brand-100 text-brand-700'}`}>{counts[k.id]}</span>}</button>)}
      </div>
      <DataGrid key={tab} endpoint={kind.endpoint} params={{ status: 'SUBMITTED' }} refreshKey={tick} columns={columns} exportName={`review-${tab}`}
        emptyTitle="Nothing to review here" emptyText="When someone sends records for review they will appear in this list." emptyAction={<CheckCheck className="w-6 h-6 mx-auto text-ok-600" />} />
    </div>
  );
}
