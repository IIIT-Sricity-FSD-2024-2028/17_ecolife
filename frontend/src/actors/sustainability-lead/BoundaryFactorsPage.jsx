import { findUnit } from '../../utils/labels';
import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useOptions, toOptions } from '../../hooks/useOptions';
import { useDialog, Dialog } from '../../components/ui/Dialogs';
import { Button, Card, FormGrid, NumberField, SelectField, StatusBadge, TextField, TextAreaField, CheckField, EmptyState, PageHeader } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { fmtNum } from '../../utils/formatters';

const DOMAIN = { FUEL: 'Fuel', ELECTRICITY_THERMAL: 'Electricity', REFRIGERANT: 'Cooling gas', WATER: 'Water', WASTE: 'Waste', AIR_EMISSION: 'Air emissions', RAW_MATERIAL: 'Raw material', LAND_GREENBELT: 'Land and green belt' };
const SCOPE = { SCOPE_1: 'Scope 1: fuel burned on site', SCOPE_2: 'Scope 2: electricity bought', SCOPE_3: 'Scope 3: supply chain', BIOGENIC: 'Biogenic: from plants and waste', NON_GHG: 'Not a greenhouse gas' };
const FACILITY = { MANUFACTURING_PLANT: 'Manufacturing plant', OFFICE: 'Office', WAREHOUSE: 'Warehouse', DATA_CENTER: 'Data centre', MINE: 'Mine', UTILITY_PLANT: 'Utility plant', OTHER: 'Other' };
const DEFAULT_SCOPE = { FUEL: 'SCOPE_1', ELECTRICITY_THERMAL: 'SCOPE_2', REFRIGERANT: 'SCOPE_1' };
const TABS = [['sites', 'Sites'], ['meters', 'Meters and fuels'], ['factors', 'Emission factors'], ['exclusions', 'Left out of reporting']];

function SiteDialog({ open, onClose, entities, states, onSaved }) {
  const { pushToast } = useToast();
  const [v, setV] = useState({ entityId: '', name: '', facilityType: 'MANUFACTURING_PLANT', city: '', state: '', isSharedBuilding: false, floorAreaSharePct: '', isWaterStressArea: false, spcbWaterLimitKl: '' });
  const [busy, setBusy] = useState(false);
  const { enums } = useOptions();
  const eid = v.entityId || entities.find((e) => e.approvalStatus === 'APPROVED')?.id || '';
  const n = (x) => (x === '' ? undefined : Number(x));
  async function save(e) {
    e.preventDefault(); setBusy(true);
    try { await apiFetch('/facilities', { method: 'POST', body: JSON.stringify({ entityId: eid, name: v.name.trim(), facilityType: v.facilityType, city: v.city.trim(), state: v.state, isSharedBuilding: v.isSharedBuilding, floorAreaSharePct: v.isSharedBuilding ? n(v.floorAreaSharePct) : undefined, isWaterStressArea: v.isWaterStressArea, spcbWaterLimitKl: n(v.spcbWaterLimitKl) }) }); pushToast('Site added. It can take data once it is approved.'); onSaved(); onClose(); }
    catch (err) { pushToast(err.message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onClose={onClose} wide title="Add a site" description="A plant, office or warehouse that uses energy or produces waste.">
      <form onSubmit={save} className="space-y-4">
        <FormGrid cols={2}>
          {entities.filter((e) => e.approvalStatus === 'APPROVED').length > 1 && <SelectField className="sm:col-span-2" label="Which company does it belong to?" required value={eid} onChange={(x) => setV({ ...v, entityId: x })} options={entities.filter((e) => e.approvalStatus === 'APPROVED').map((e) => ({ value: e.id, label: e.name }))} />}
          <TextField label="Site name" required placeholder="e.g. Chakan Plant 2" value={v.name} onChange={(x) => setV({ ...v, name: x })} />
          <SelectField label="Kind of site" required value={v.facilityType} onChange={(x) => setV({ ...v, facilityType: x })} options={toOptions(enums.FacilityType, FACILITY)} />
          <TextField label="City" required placeholder="e.g. Pune" value={v.city} onChange={(x) => setV({ ...v, city: x })} />
          <SelectField label="State" required value={v.state} onChange={(x) => setV({ ...v, state: x })} placeholder="Choose a state" options={states.map((s) => ({ value: s, label: s }))} />
          <NumberField label="Water use limit in your consent" optional unit="kL / day" min="0" value={v.spcbWaterLimitKl} onChange={(x) => setV({ ...v, spcbWaterLimitKl: x })} hint="From the pollution control board consent, if you have one." />
          <div className="space-y-2 pt-1"><CheckField label="Water is scarce in this area" checked={v.isWaterStressArea} onChange={(x) => setV({ ...v, isWaterStressArea: x })} /><CheckField label="We share the building with others" checked={v.isSharedBuilding} onChange={(x) => setV({ ...v, isSharedBuilding: x })} /></div>
          {v.isSharedBuilding && <NumberField label="Your share of the floor area" required unit="%" min="1" max="100" value={v.floorAreaSharePct} onChange={(x) => setV({ ...v, floorAreaSharePct: x })} hint="Only this share of shared bills is counted." />}
        </FormGrid>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy} disabled={!eid || !v.name.trim() || !v.city.trim() || !v.state || (v.isSharedBuilding && v.floorAreaSharePct === '')}>Add site</Button></div>
      </form>
    </Dialog>
  );
}

function MeterDialog({ open, onClose, sites, onSaved }) {
  const { pushToast } = useToast();
  const { enums, rules } = useOptions();
  const [v, setV] = useState({ facilityId: '', name: '', domain: '', scope: '', canonicalUnit: '', defaultFactorId: '', meterSerialNo: '' });
  const [busy, setBusy] = useState(false);
  const { data: factors } = useApi(open && v.domain ? `/factors?page=1&pageSize=100&domain=${v.domain}&status=PUBLISHED` : null);
  const units = rules.units || [];
  const dim = { FUEL: ['volume', 'mass', 'energy'], ELECTRICITY_THERMAL: ['energy'], REFRIGERANT: ['mass'] }[v.domain] || [];
  const pickFactor = (id) => { const f = factors?.items?.find((x) => x.id === id); setV((s) => ({ ...s, defaultFactorId: id, ...(f ? { canonicalUnit: findUnit(units, f.canonicalUnit)?.key || s.canonicalUnit } : {}) })); };
  async function save(e) {
    e.preventDefault(); setBusy(true);
    try { await apiFetch('/sources', { method: 'POST', body: JSON.stringify({ facilityId: v.facilityId, name: v.name.trim(), domain: v.domain, scope: v.scope, canonicalUnit: v.canonicalUnit, defaultFactorId: v.defaultFactorId || undefined, meterSerialNo: v.meterSerialNo.trim() || undefined }) }); pushToast('Meter added.'); onSaved(); onClose(); }
    catch (err) { pushToast(err.message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onClose={onClose} wide title="Add a meter or fuel" description="Each electricity meter, fuel tank or gas line you take readings from.">
      <form onSubmit={save} className="space-y-4">
        <FormGrid cols={2}>
          <SelectField label="Site" required value={v.facilityId} onChange={(x) => setV({ ...v, facilityId: x })} placeholder="Choose a site" options={sites.map((s) => ({ value: s.id, label: s.name }))} />
          <TextField label="Name" required placeholder="e.g. Grid meter, main incomer" value={v.name} onChange={(x) => setV({ ...v, name: x })} />
          <SelectField label="What is it?" required value={v.domain} onChange={(x) => setV({ ...v, domain: x, scope: DEFAULT_SCOPE[x] || '', defaultFactorId: '', canonicalUnit: '' })} placeholder="Choose a type" options={toOptions(['FUEL', 'ELECTRICITY_THERMAL', 'REFRIGERANT'].filter((d) => !enums.ResourceDomain || enums.ResourceDomain.includes(d)), DOMAIN)} />
          <SelectField label="Counted as" required value={v.scope} onChange={(x) => setV({ ...v, scope: x })} placeholder="Choose" options={toOptions(enums.EmissionScope, SCOPE)} hint="Usually filled in for you." />
          <SelectField className="sm:col-span-2" label="Emission factor" optional value={v.defaultFactorId} onChange={pickFactor} placeholder={v.domain ? 'Choose the factor that matches' : 'Choose what it is first'} options={(factors?.items || []).map((f) => ({ value: f.id, label: f.name }))} hint="The factor turns the amount into emissions. Official factors are published with their source." />
          <SelectField label="Unit on the bill or meter" required value={v.canonicalUnit} onChange={(x) => setV({ ...v, canonicalUnit: x })} placeholder="Choose a unit" options={units.filter((u) => dim.includes(u.dimension)).map((u) => ({ value: u.key, label: u.label }))} />
          <TextField label="Meter serial number" optional placeholder="From the meter plate" value={v.meterSerialNo} onChange={(x) => setV({ ...v, meterSerialNo: x })} />
        </FormGrid>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy} disabled={!v.facilityId || !v.name.trim() || !v.domain || !v.scope || !v.canonicalUnit}>Add meter</Button></div>
      </form>
    </Dialog>
  );
}

export default function BoundaryFactorsPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const dialog = useDialog();
  const { enums } = useOptions();
  const { data: pub } = useApi('/meta/public');
  const { data: entities, refetch: refE } = useApi('/entities');
  const { data: sites, refetch: refS } = useApi('/facilities');
  const { data: exclusions, refetch: refX } = useApi('/boundary-exclusions');
  const { data: periods } = useApi('/periods');
  const [tab, setTab] = useState('sites');
  const [tick, setTick] = useState(0);
  const [siteDlg, setSiteDlg] = useState(false);
  const [meterDlg, setMeterDlg] = useState(false);
  const [q, setQ] = useState(''); const [dom, setDom] = useState('');
  const roles = user?.roles || [];
  const canApprove = roles.some((r) => ['EXECUTIVE_APPROVER', 'ORG_ADMIN'].includes(r));
  const canDecideFactor = roles.some((r) => ['EXECUTIVE_APPROVER', 'SUSTAINABILITY_LEAD'].includes(r));
  const years = useMemo(() => [...new Set((periods || []).map((p) => p.financialYear))].sort().reverse(), [periods]);

  async function call(path, method, body, ok, after) { try { await apiFetch(path, { method, body: JSON.stringify(body) }); pushToast(ok); after?.(); } catch (e) { pushToast(e.message, 'error'); } }
  async function addFactor() {
    const v = await dialog.form({ title: 'Add your own emission factor', description: 'Use this when a lab certificate or supplier gives a figure specific to you. A second person must approve it before it can be used.', submitLabel: 'Send for approval', wide: true, fields: [
      { name: 'name', type: 'text', label: 'Name', required: true, placeholder: 'e.g. Coal from Mine X, lab tested' }, { name: 'code', type: 'text', label: 'Short code', required: true, placeholder: 'e.g. LAB_COAL_01', hint: 'Capital letters, digits and underscores.' },
      { name: 'domain', type: 'select', label: 'What is it for?', required: true, options: toOptions(enums.ResourceDomain, DOMAIN) }, { name: 'scope', type: 'select', label: 'Counted as', required: true, options: toOptions(enums.EmissionScope, SCOPE) },
      { name: 'canonicalUnit', type: 'text', label: 'Per what unit?', required: true, placeholder: 'e.g. kg, litre, kWh' }, { name: 'co2', type: 'number', label: 'Carbon dioxide released per unit (kg)', required: true },
      { name: 'ch4', type: 'number', label: 'Methane per unit (kg)', hint: 'Leave empty if not known.' }, { name: 'n2o', type: 'number', label: 'Nitrous oxide per unit (kg)', hint: 'Leave empty if not known.' },
      { name: 'sourceAuthority', type: 'text', label: 'Where does the figure come from?', required: true, placeholder: 'e.g. NABL lab report 4471, 3 May 2026' }, { name: 'validFrom', type: 'date', label: 'Valid from', required: true }] });
    if (!v) return;
    call('/factors', 'POST', { code: v.code.trim().toUpperCase(), name: v.name.trim(), domain: v.domain, scope: v.scope, canonicalUnit: v.canonicalUnit.trim(), co2KgPerUnit: Number(v.co2), ch4KgPerUnit: v.ch4 === '' ? undefined : Number(v.ch4), n2oKgPerUnit: v.n2o === '' ? undefined : Number(v.n2o), sourceAuthority: v.sourceAuthority.trim(), versionLabel: 'v1', validFrom: v.validFrom }, 'Sent for approval.', () => setTick((t) => t + 1));
  }
  async function addExclusion() {
    const v = await dialog.form({ title: 'Leave something out of reporting', description: 'If part of your emissions is not counted, say what and why. Auditors will ask. A second person approves it.', submitLabel: 'Send for approval', wide: true, fields: [
      { name: 'financialYear', type: 'select', label: 'Financial year', required: true, options: years.map((y) => ({ value: y, label: y })) }, { name: 'scope', type: 'select', label: 'Which part?', required: true, options: toOptions(['SCOPE_1', 'SCOPE_2', 'SCOPE_3'], SCOPE) },
      { name: 'cat', type: 'number', label: 'Supply-chain category number (1 to 15)', hint: 'Only for Scope 3. Leave empty otherwise.' }, { name: 'excludedItemName', type: 'text', label: 'What is left out?', required: true, placeholder: 'e.g. Business flights' },
      { name: 'justification', type: 'textarea', label: 'Why?', required: true, minLength: 20, placeholder: 'e.g. Fewer than five trips a year. Less than 0.5% of our total.' }, { name: 'pct', type: 'number', label: 'About what share of your total? (%)', hint: 'Your best estimate.' }] });
    if (!v) return;
    call('/boundary-exclusions', 'POST', { financialYear: v.financialYear, scope: v.scope, scope3Category: v.scope === 'SCOPE_3' ? Number(v.cat) : undefined, excludedItemName: v.excludedItemName.trim(), justification: v.justification.trim(), estimatedMaterialityPct: v.pct === '' ? undefined : Number(v.pct) }, 'Sent for approval.', refX);
  }
  const decideBtn = (onYes, onNo) => <div className="flex gap-1.5 justify-end"><Button size="sm" onClick={onYes}>Approve</Button><Button size="sm" variant="secondary" onClick={onNo}>Reject</Button></div>;
  const decideSite = (kind, id, status) => call(`/${kind}/${id}/approve`, 'PATCH', { status }, status === 'APPROVED' ? 'Approved.' : 'Rejected.', () => { refS(); refE(); });

  return (
    <div>
      <PageHeader title="Sites and emission factors" description="What you report on: your sites, the meters at each, and the factors that turn amounts into emissions." />
      <div role="tablist" className="flex flex-wrap gap-1.5 mb-4">{TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`h-9 px-3.5 rounded-md text-sm font-medium border ${tab === id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-text border-line-strong hover:bg-brand-50'}`}>{label}</button>)}</div>

      {tab === 'sites' && <Card title="Your sites" actions={<Button onClick={() => setSiteDlg(true)}><Plus className="w-4 h-4" /> Add a site</Button>} padded={false}>
        {!sites ? <div className="h-24 animate-pulse" /> : sites.length === 0 ? <EmptyState title="No sites yet" action={<Button onClick={() => setSiteDlg(true)}>Add your first site</Button>}>Add the plants and offices you want to report on.</EmptyState> : (
          <ul className="divide-y divide-line">{sites.map((s) => <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><div className="flex-1 min-w-[12rem]"><div className="font-medium">{s.name}</div><div className="text-sm text-muted">{FACILITY[s.facilityType] || s.facilityType} · {s.city}, {s.state}</div></div><StatusBadge status={s.approvalStatus === 'APPROVED' ? 'ACTIVE' : s.approvalStatus} label={s.approvalStatus === 'APPROVED' ? 'In use' : s.approvalStatus === 'PENDING' ? 'Waiting for approval' : 'Rejected'} />{s.approvalStatus === 'PENDING' && canApprove && decideBtn(() => decideSite('facilities', s.id, 'APPROVED'), () => decideSite('facilities', s.id, 'REJECTED'))}</li>)}</ul>)}
        <SiteDialog open={siteDlg} onClose={() => setSiteDlg(false)} entities={entities || []} states={pub?.states || []} onSaved={refS} />
      </Card>}

      {tab === 'meters' && <>
        <DataGrid endpoint="/sources" params={{ q, domain: dom }} refreshKey={tick} exportName="meters"
          toolbar={<><TextField className="w-56" label="" aria-label="Search meters" placeholder="Search by name or serial" value={q} onChange={setQ} /><SelectField className="w-44" label="" aria-label="Type" value={dom} onChange={setDom} placeholder="All types" options={toOptions(['FUEL', 'ELECTRICITY_THERMAL', 'REFRIGERANT', 'WATER', 'WASTE'], DOMAIN)} /><Button onClick={() => setMeterDlg(true)}><Plus className="w-4 h-4" /> Add a meter</Button></>}
          columns={[{ key: 'n', label: 'Meter or fuel', render: (r) => <><div className="font-medium">{r.name}</div><div className="text-xs text-muted">{r.facility?.name}{r.meterSerialNo ? ` · ${r.meterSerialNo}` : ''}</div></>, value: (r) => r.name },
            { key: 'd', label: 'Type', render: (r) => DOMAIN[r.domain] || r.domain, value: (r) => r.domain }, { key: 's', label: 'Counted as', render: (r) => (SCOPE[r.scope] || r.scope).split(':')[0], value: (r) => r.scope }, { key: 'u', label: 'Unit', render: (r) => r.canonicalUnit, value: (r) => r.canonicalUnit },
            { key: 'f', label: 'Factor', render: (r) => r.defaultFactor?.name || <span className="text-subtle">Chosen when entering</span>, value: (r) => r.defaultFactor?.name }, { key: 'o', label: 'Owner', render: (r) => r.owner?.fullName || <span className="text-saffron-600">None</span>, value: (r) => r.owner?.fullName }]}
          emptyTitle="No meters yet" emptyText="Add the electricity meters and fuels at your sites so people can record data against them." />
        <MeterDialog open={meterDlg} onClose={() => setMeterDlg(false)} sites={(sites || []).filter((s) => s.approvalStatus === 'APPROVED')} onSaved={() => setTick((t) => t + 1)} />
      </>}

      {tab === 'factors' && <DataGrid endpoint="/factors" params={{ q, domain: dom }} refreshKey={tick} exportName="emission-factors"
        toolbar={<><TextField className="w-56" label="" aria-label="Search factors" placeholder="Search diesel, coal, grid…" value={q} onChange={setQ} /><SelectField className="w-44" label="" aria-label="Type" value={dom} onChange={setDom} placeholder="All types" options={toOptions(enums.ResourceDomain, DOMAIN)} /><Button variant="secondary" onClick={addFactor}><Plus className="w-4 h-4" /> Add your own</Button></>}
        columns={[{ key: 'n', label: 'Factor', render: (r) => <><div className="font-medium">{r.name}</div><div className="text-xs text-muted">{r.sourceAuthority} · {r.versionLabel}</div></>, value: (r) => r.name },
          { key: 'c', label: 'CO₂ per unit (kg)', numeric: true, render: (r) => `${fmtNum(r.co2KgPerUnit, 4)} / ${r.canonicalUnit}`, value: (r) => r.co2KgPerUnit }, { key: 'o', label: 'From', render: (r) => (r.organizationId ? 'Your company' : 'Official library'), value: (r) => (r.organizationId ? 'Own' : 'Official') },
          { key: 'st', label: 'Status', render: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
          { key: 'a', label: '', render: (r) => r.status === 'PENDING_APPROVAL' && canDecideFactor ? decideBtn(() => call(`/factors/${r.id}/approve`, 'PATCH', { decision: 'APPROVED' }, 'Approved.', () => setTick((t) => t + 1)), () => call(`/factors/${r.id}/approve`, 'PATCH', { decision: 'REJECTED' }, 'Rejected.', () => setTick((t) => t + 1))) : null }]}
        emptyTitle="No factors match" emptyText="Try a shorter search." />}

      {tab === 'exclusions' && <Card title="Left out of reporting" description="Anything you do not count, with the reason." actions={<Button onClick={addExclusion}><Plus className="w-4 h-4" /> Add</Button>} padded={false}>
        {!exclusions ? <div className="h-24 animate-pulse" /> : exclusions.length === 0 ? <EmptyState title="Nothing is left out">If you leave part of your emissions out, record it here.</EmptyState> : (
          <ul className="divide-y divide-line">{exclusions.map((x) => <li key={x.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><div className="flex-1 min-w-[14rem]"><div className="font-medium">{x.excludedItemName} <span className="text-muted font-normal">· {x.financialYear}</span></div><div className="text-sm text-muted">{x.justification}</div></div><StatusBadge status={x.status} label={x.status === 'PENDING' ? 'Waiting for approval' : x.status === 'APPROVED' ? 'Approved' : 'Rejected'} />{x.status === 'PENDING' && canDecideFactor && decideBtn(() => call(`/boundary-exclusions/${x.id}/decide`, 'PATCH', { status: 'APPROVED' }, 'Approved.', refX), () => call(`/boundary-exclusions/${x.id}/decide`, 'PATCH', { status: 'REJECTED' }, 'Rejected.', refX))}</li>)}</ul>)}
      </Card>}
    </div>
  );
}
