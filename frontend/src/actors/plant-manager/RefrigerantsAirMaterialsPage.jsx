import React, { useMemo, useState } from 'react';
import { apiFetch } from '../../services/apiClient';
import { useApi } from '../../hooks/useApi';
import { useOptions, toOptions } from '../../hooks/useOptions';
import { useToast } from '../../context/ToastContext';
import { Button, Card, CheckField, EmptyState, FormGrid, NextStep, NumberField, SelectField, TextField } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { ScopeBar, useReportingScope } from '../../components/domain/ReportingScope';
import { RowActions, StatusBadge } from '../../components/common/LogWorkbench';
import { fmtNum } from '../../utils/formatters';

const POLLUTANT = { NOX: 'Nitrogen oxides (NOx)', SOX: 'Sulphur oxides (SOx)', PM: 'Dust (particulate matter)', PM10: 'Fine dust (PM10)', PM2_5: 'Very fine dust (PM2.5)', VOC: 'Solvent vapours (VOC)', POP: 'Persistent organic pollutants', HAP: 'Hazardous air pollutants' };
const ORIGIN = { VIRGIN: 'New (virgin) material', RECYCLED: 'Recycled material', REUSED: 'Reused material' };
const METHOD = { MATERIAL_BALANCE: 'Measured: gas bought minus gas left (best)', SIMPLIFIED_MATERIAL_BALANCE: 'Simple balance of gas added and recovered', SALES_BASED: 'From the gas supplier’s sales record', SCREENING: 'Rough estimate from the equipment size' };
const TABS = [['air', 'Air emissions'], ['materials', 'Materials'], ['cooling', 'Cooling gases']];

export default function RefrigerantsAirMaterialsPage() {
  const { pushToast } = useToast();
  const { enums } = useOptions();
  const scope = useReportingScope();
  const [tab, setTab] = useState('air');
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const { data: gwp } = useApi('/resources/gwp');
  const { data: equipment, refetch: refEq } = useApi('/resources/refrigerants');
  const { data: sources } = useApi('/sources');
  const [a, setA] = useState({ stackId: '', pollutant: '', quantityKg: '', spcbLimitKg: '', spcbLimitNote: '' });
  const [m, setM] = useState({ materialName: '', origin: '', quantityMt: '', isPackagingEpr: false });
  const [r, setR] = useState({ equipmentName: '', refrigerantCode: '', nameplateKg: '' });
  const [t, setT] = useState({ equipmentId: '', sourceId: '', kg: '', method: '' });
  const over = a.spcbLimitKg !== '' && a.quantityKg !== '' && Number(a.quantityKg) > Number(a.spcbLimitKg);
  const gases = (gwp || []).filter((g) => !['CO2', 'N2O', 'CH4_FOSSIL', 'CH4_NON_FOSSIL'].includes(g.gasCode));
  const siteEquipment = (equipment || []).filter((e) => e.facilityId === scope.facilityId);
  const coolingSources = (sources || []).filter((s) => s.facilityId === scope.facilityId && s.domain === 'REFRIGERANT');
  const where = { facilityId: scope.facilityId, periodId: scope.periodId };
  const done = () => setTick((x) => x + 1);

  async function post(path, body, ok, reset) {
    setBusy(true);
    try { await apiFetch(path, { method: 'POST', body: JSON.stringify(body) }); pushToast(ok); reset?.(); done(); } catch (err) { pushToast(err.message, 'error'); } finally { setBusy(false); }
  }
  const saveAir = (e) => { e.preventDefault(); post('/resources/air-emissions', { ...where, stackId: a.stackId.trim(), pollutant: a.pollutant, quantityKg: Number(a.quantityKg), ...(a.spcbLimitKg !== '' ? { spcbLimitKg: Number(a.spcbLimitKg) } : {}), ...(a.spcbLimitNote ? { spcbLimitNote: a.spcbLimitNote.trim() } : {}) }, 'Saved as a draft.', () => setA((x) => ({ ...x, quantityKg: '', spcbLimitNote: '' }))); };
  const saveMat = (e) => { e.preventDefault(); post('/resources/materials', { ...where, materialName: m.materialName.trim(), origin: m.origin, quantityMt: Number(m.quantityMt), isPackagingEpr: m.isPackagingEpr }, 'Saved as a draft.', () => setM((x) => ({ ...x, materialName: '', quantityMt: '' }))); };
  const saveEq = (e) => { e.preventDefault(); post('/resources/refrigerants', { facilityId: scope.facilityId, equipmentName: r.equipmentName.trim(), refrigerantCode: r.refrigerantCode, nameplateKg: Number(r.nameplateKg) }, 'Equipment added.', () => { setR((x) => ({ ...x, equipmentName: '', nameplateKg: '' })); refEq(); }); };
  const saveTop = (e) => { e.preventDefault(); post('/entries', { periodId: scope.periodId, sourceId: t.sourceId, refrigerantEquipmentId: t.equipmentId, rawQuantity: Number(t.kg), rawUnit: 'kg', refrigerantMethod: t.method }, 'Saved as a draft.', () => setT((x) => ({ ...x, kg: '' }))); };

  const site = (x) => x.facility?.name || '';
  const cols = {
    air: [
      { key: 's', label: 'Stack', render: (x) => <><div className="font-medium">{x.stackId}</div><div className="text-xs text-muted">{x.period?.label}</div></>, value: (x) => x.stackId },
      { key: 'p', label: 'Pollutant', render: (x) => POLLUTANT[x.pollutant] || x.pollutant, value: (x) => x.pollutant },
      { key: 'q', label: 'Released (kg)', numeric: true, render: (x) => <span className={x.exceedsLimit ? 'text-danger-600 font-medium' : ''}>{fmtNum(x.quantityKg, 2)}</span>, value: (x) => x.quantityKg },
      { key: 'l', label: 'Legal limit (kg)', numeric: true, render: (x) => (x.spcbLimitKg ? fmtNum(x.spcbLimitKg, 2) : '—'), value: (x) => x.spcbLimitKg },
      { key: 'st', label: 'Status', render: (x) => <><StatusBadge status={x.status} />{x.exceedsLimit && <div className="text-xs text-danger-600 mt-0.5">Above the legal limit</div>}</>, value: (x) => x.status },
      { key: 'a', label: '', render: (x) => <RowActions kind="air-emissions" row={x} onDone={done} /> }],
    materials: [
      { key: 'm', label: 'Material', render: (x) => <><div className="font-medium">{x.materialName}</div><div className="text-xs text-muted">{x.period?.label}{x.isPackagingEpr ? ' · packaging' : ''}</div></>, value: (x) => x.materialName },
      { key: 'o', label: 'Kind', render: (x) => ORIGIN[x.origin] || x.origin, value: (x) => x.origin },
      { key: 'q', label: 'Weight (tonnes)', numeric: true, render: (x) => fmtNum(x.quantityMt, 3), value: (x) => x.quantityMt },
      { key: 'st', label: 'Status', render: (x) => <StatusBadge status={x.status} />, value: (x) => x.status },
      { key: 'a', label: '', render: (x) => <RowActions kind="materials" row={x} onDone={done} /> }]
  };
  const ready = scope.facilityId && scope.periodId;

  return (
    <div>
      <div className="mb-5"><h1 className="text-[1.5rem] font-semibold">Air, materials and cooling gases</h1><p className="text-muted mt-1">Stack readings, raw materials used, and the gas in your chillers and air conditioners.</p></div>
      <ScopeBar scope={scope} />
      {scope.months.length === 0 && !scope.loading && <NextStep tone="warn" title="No open month for this site">Ask a sustainability lead to open the month in Month-end close.</NextStep>}
      <div role="tablist" className="flex gap-1.5 mb-4">{TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`h-9 px-3.5 rounded-md text-sm font-medium border ${tab === id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-text border-line-strong hover:bg-brand-50'}`}>{label}</button>)}</div>

      {tab === 'air' && <>
        <Card title="Add a stack reading" description="One record for each stack and each pollutant. Use the figure from your stack monitoring report.">
          <form onSubmit={saveAir} className="space-y-4">
            <FormGrid cols={3}>
              <TextField label="Stack name or number" required placeholder="e.g. Boiler stack 1" value={a.stackId} onChange={(v) => setA({ ...a, stackId: v })} />
              <SelectField label="What was measured?" required value={a.pollutant} onChange={(v) => setA({ ...a, pollutant: v })} placeholder="Choose a pollutant" options={toOptions(enums.AirPollutant, POLLUTANT)} />
              <NumberField label="Total released this month" required unit="kg" min="0" value={a.quantityKg} onChange={(v) => setA({ ...a, quantityKg: v })} hint="Concentration times flow times hours run, from the report." />
              <NumberField label="Legal limit for the month" optional unit="kg" min="0" value={a.spcbLimitKg} onChange={(v) => setA({ ...a, spcbLimitKg: v })} hint="From your pollution control board consent. Leave empty if none." />
              {over && <TextField className="sm:col-span-2" label="Why was it above the limit, and what are you doing about it?" required minLength={10} value={a.spcbLimitNote} onChange={(v) => setA({ ...a, spcbLimitNote: v })} error={a.spcbLimitNote.trim().length < 10 ? 'This is above the legal limit. Explain the cause and the fix (at least 10 characters).' : undefined} />}
            </FormGrid>
            <div className="flex justify-end"><Button type="submit" loading={busy} disabled={!ready || !a.stackId.trim() || !a.pollutant || a.quantityKg === '' || (over && a.spcbLimitNote.trim().length < 10)}>Save as draft</Button></div>
          </form>
        </Card>
        <div className="mt-4"><DataGrid key="air" endpoint="/resources/air-emissions" params={where} refreshKey={tick} columns={cols.air} exportName="air-emissions" emptyTitle="No stack readings for this month yet" emptyText="Add the first reading above." /></div>
      </>}

      {tab === 'materials' && <>
        <Card title="Add a material" description="Record the raw and packaging materials you used, and whether they were new or recycled.">
          <form onSubmit={saveMat} className="space-y-4">
            <FormGrid cols={3}>
              <TextField label="Material" required placeholder="e.g. Mild steel bar" value={m.materialName} onChange={(v) => setM({ ...m, materialName: v })} />
              <SelectField label="New or recycled?" required value={m.origin} onChange={(v) => setM({ ...m, origin: v })} placeholder="Choose one" options={toOptions(enums.MaterialOrigin, ORIGIN)} />
              <NumberField label="Weight" required unit="tonnes" min="0" value={m.quantityMt} onChange={(v) => setM({ ...m, quantityMt: v })} hint="1 tonne = 1,000 kg." />
              <div className="flex items-end pb-2"><CheckField label="This is packaging material" checked={m.isPackagingEpr} onChange={(v) => setM({ ...m, isPackagingEpr: v })} hint="Counts towards packaging take-back (EPR) reporting." /></div>
            </FormGrid>
            <div className="flex justify-end"><Button type="submit" loading={busy} disabled={!ready || !m.materialName.trim() || !m.origin || m.quantityMt === ''}>Save as draft</Button></div>
          </form>
        </Card>
        <div className="mt-4"><DataGrid key="mat" endpoint="/resources/materials" params={where} refreshKey={tick} columns={cols.materials} exportName="materials" emptyTitle="No materials for this month yet" emptyText="Add the first material above." /></div>
      </>}

      {tab === 'cooling' && <>
        <Card title="Your cooling equipment" description="Chillers, air conditioners and cold rooms hold gases that warm the planet if they leak. List each one here once.">
          <form onSubmit={saveEq} className="space-y-4">
            <FormGrid cols={3}>
              <TextField label="Equipment name" required placeholder="e.g. Chiller 2, canteen" value={r.equipmentName} onChange={(v) => setR({ ...r, equipmentName: v })} />
              <SelectField label="Gas inside" required value={r.refrigerantCode} onChange={(v) => setR({ ...r, refrigerantCode: v })} placeholder="Choose the gas" options={gases.map((g) => ({ value: g.gasCode, label: g.gasCode.replace(/_/g, '-') }))} hint="Printed on the nameplate, for example R-410A." />
              <NumberField label="Full charge" required unit="kg" min="0" value={r.nameplateKg} onChange={(v) => setR({ ...r, nameplateKg: v })} hint="Also on the nameplate." />
            </FormGrid>
            <div className="flex justify-end"><Button type="submit" loading={busy} disabled={!scope.facilityId || !r.equipmentName.trim() || !r.refrigerantCode || r.nameplateKg === ''}>Add equipment</Button></div>
          </form>
          {siteEquipment.length > 0 && <ul className="mt-4 divide-y divide-line border border-line rounded-md">{siteEquipment.map((e) => <li key={e.id} className="px-3 py-2 flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{e.equipmentName}</span><span className="text-muted tabular-nums">{e.refrigerantCode.replace(/_/g, '-')} · {fmtNum(e.nameplateKg, 1)} kg</span></li>)}</ul>}
        </Card>
        <div className="mt-4"><Card title="Record gas added" description="When a technician tops up the gas, it means gas leaked out. Record the amount added.">
          {siteEquipment.length === 0 ? <EmptyState title="Add your equipment first">Gas top-ups are recorded against a piece of equipment.</EmptyState> : coolingSources.length === 0 ? <NextStep tone="warn" title="No cooling-gas meter set up for this site">Ask a sustainability lead to add one under Sites and emission factors.</NextStep> : (
            <form onSubmit={saveTop} className="space-y-4">
              <FormGrid cols={2}>
                <SelectField label="Which equipment?" required value={t.equipmentId} onChange={(v) => setT({ ...t, equipmentId: v })} placeholder="Choose equipment" options={siteEquipment.map((e) => ({ value: e.id, label: e.equipmentName }))} />
                <SelectField label="Record against" required value={t.sourceId} onChange={(v) => setT({ ...t, sourceId: v })} placeholder="Choose" options={coolingSources.map((s) => ({ value: s.id, label: s.name }))} />
                <NumberField label="Gas added" required unit="kg" min="0" value={t.kg} onChange={(v) => setT({ ...t, kg: v })} hint="From the technician’s service report." />
                <SelectField label="How do you know?" required value={t.method} onChange={(v) => setT({ ...t, method: v })} placeholder="Choose one" options={toOptions(enums.RefrigerantMethod, METHOD)} />
              </FormGrid>
              <div className="flex justify-end"><Button type="submit" loading={busy} disabled={!scope.periodId || !t.equipmentId || !t.sourceId || t.kg === '' || !t.method}>Save as draft</Button></div>
            </form>)}
        </Card></div>
        <div className="mt-4"><DataGrid key="cool" endpoint="/entries" params={{ ...where, domain: 'REFRIGERANT' }} refreshKey={tick} exportName="cooling-gas"
          columns={[{ key: 's', label: 'Record', render: (x) => <><div className="font-medium">{x.source?.name}</div><div className="text-xs text-muted">{x.period?.label}</div></> , value: (x) => x.source?.name }, { key: 'q', label: 'Gas added (kg)', numeric: true, render: (x) => fmtNum(x.normalizedQuantity, 2), value: (x) => x.normalizedQuantity }, { key: 'e', label: 'Emissions (tCO₂e)', numeric: true, render: (x) => fmtNum(x.calculatedTco2eAr6, 3), value: (x) => x.calculatedTco2eAr6 }, { key: 'st', label: 'Status', render: (x) => <StatusBadge status={x.status} />, value: (x) => x.status },
            { key: 'a', label: '', render: (x) => ['DRAFT', 'REJECTED'].includes(x.status) ? <Button size="sm" onClick={() => apiFetch(`/entries/${x.id}/submit`, { method: 'POST' }).then(() => { pushToast('Sent for review.'); done(); }).catch((e) => pushToast(e.message, 'error'))}>Send for review</Button> : null }]}
          emptyTitle="No gas top-ups this month" emptyText="If no gas was added to any equipment, nothing needs recording." /></div>
      </>}
    </div>
  );
}
