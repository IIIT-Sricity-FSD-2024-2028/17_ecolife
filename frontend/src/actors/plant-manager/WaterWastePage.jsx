import React, { useCallback, useMemo, useState } from 'react';
import { Droplets, Recycle } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import { useOptions, toOptions } from '../../hooks/useOptions';
import { useApi } from '../../hooks/useApi';
import { fmtNum } from '../../utils/formatters';
import { WATER_SOURCE, WATER_DEST, TREATMENT, WASTE_CATEGORY, WASTE_ROUTE } from '../../utils/labels';
import { Button, Card, CheckField, FormGrid, NextStep, NumberField, PageHeader, SelectField, StatusBadge, TextField } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { ScopeBar, useReportingScope } from '../../components/domain/ReportingScope';
import { RowActions } from '../../components/common/LogWorkbench';

const EMPTY_WATER = { withdrawalSource: 'GROUNDWATER', withdrawalKl: '', dischargeKl: '', recycledKl: '', dischargeDestination: '', treatmentLevel: '' };
const EMPTY_WASTE = { wasteCategory: '', treatmentRoute: '', quantityMt: '', isOnsite: false, manifestRef: '' };

function Dot({ tone }) { return <span className={`inline-block w-2 h-2 rounded-full mr-2 ${tone === 'bad' ? 'bg-danger-600' : 'bg-ok-600'}`} />; }

export default function WaterWastePage() {
  const { pushToast } = useToast();
  const { enums, rules } = useOptions();
  const scope = useReportingScope();
  const [tab, setTab] = useState('water');
  const [w, setW] = useState(EMPTY_WATER);
  const [ws, setWs] = useState(EMPTY_WASTE);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const { facilityId, periodId } = scope;

  const { data: drafts } = useApi(facilityId && periodId ? `/resources/${tab}?facilityId=${facilityId}&periodId=${periodId}&status=DRAFT&page=1&pageSize=1&_=${tick}` : null);
  const draftCount = drafts?.total ?? 0;

  const discharging = Number(w.dischargeKl) > 0;
  const zld = w.dischargeDestination === 'ZLD_RECYCLED';
  const consumed = w.withdrawalKl === '' ? null : Math.max(0, Number(w.withdrawalKl) - Number(w.dischargeKl || 0));
  const hazardous = (rules.hazardousWasteCategories || []).includes(ws.wasteCategory);
  const needsManifest = hazardous && !ws.isOnsite;

  const save = async (kind, body, reset, message) => {
    setBusy(true);
    try {
      await apiFetch(`/resources/${kind}`, { method: 'POST', body: JSON.stringify({ facilityId, periodId, ...body }) });
      pushToast(message); reset(); refresh();
    } catch (err) { pushToast(err.message, 'error'); } finally { setBusy(false); }
  };
  const saveWater = (e) => { e.preventDefault(); save('water', {
    withdrawalSource: w.withdrawalSource, withdrawalKl: Number(w.withdrawalKl), dischargeKl: Number(w.dischargeKl || 0), recycledKl: Number(w.recycledKl || 0),
    ...(discharging ? { dischargeDestination: w.dischargeDestination, ...(w.treatmentLevel ? { treatmentLevel: w.treatmentLevel } : {}) } : {})
  }, () => setW({ ...EMPTY_WATER, withdrawalSource: w.withdrawalSource }), 'Water record saved as a draft. Send it for review when you are done.'); };
  const saveWaste = (e) => { e.preventDefault(); save('waste', {
    wasteCategory: ws.wasteCategory, treatmentRoute: ws.treatmentRoute, quantityMt: Number(ws.quantityMt), isOnsite: ws.isOnsite, ...(ws.manifestRef ? { manifestRef: ws.manifestRef.trim() } : {})
  }, () => setWs({ ...EMPTY_WASTE }), 'Waste record saved as a draft. Send it for review when you are done.'); };

  const params = useMemo(() => ({ facilityId, periodId, _: tick }), [facilityId, periodId, tick]);
  const waterCols = useMemo(() => [
    { key: 'period', label: 'Month', render: (r) => r.period?.label, value: (r) => r.period?.label },
    { key: 'src', label: 'Source', render: (r) => WATER_SOURCE[r.withdrawalSource] || r.withdrawalSource, value: (r) => WATER_SOURCE[r.withdrawalSource] },
    { key: 'in', label: 'Taken in (kL)', numeric: true, render: (r) => fmtNum(r.withdrawalKl, 1), value: (r) => r.withdrawalKl },
    { key: 'out', label: 'Sent out (kL)', numeric: true, render: (r) => fmtNum(r.dischargeKl, 1), value: (r) => r.dischargeKl },
    { key: 'used', label: 'Used up (kL)', numeric: true, render: (r) => fmtNum(r.consumptionKl, 1), value: (r) => r.consumptionKl },
    { key: 'permit', label: 'Daily average vs permit (kL)', render: (r) => (
      <span><Dot tone={r.exceedsSpcbLimit ? 'bad' : 'ok'} />{fmtNum(r.avgDailyWithdrawalKl, 1)}{r.spcbLimitKlPerDay != null ? ` of ${fmtNum(r.spcbLimitKlPerDay, 0)}` : ' (no permit limit set)'}{r.exceedsSpcbLimit ? ' · over the limit' : ''}</span>),
      value: (r) => r.avgDailyWithdrawalKl },
    { key: 'status', label: 'Status', render: (r) => <span title={r.reviewNote || ''}><StatusBadge status={r.status} />{r.status === 'REJECTED' && r.reviewNote && <div className="text-xs text-danger-600 mt-0.5 max-w-[16rem] whitespace-normal">{r.reviewNote}</div>}</span>, value: (r) => r.status },
    { key: 'act', label: '', render: (r) => <RowActions kind="water" row={r} onDone={refresh} /> }
  ], [refresh]);
  const wasteCols = useMemo(() => [
    { key: 'period', label: 'Month', render: (r) => r.period?.label, value: (r) => r.period?.label },
    { key: 'cat', label: 'Type of waste', render: (r) => WASTE_CATEGORY[r.wasteCategory] || r.wasteCategory, value: (r) => WASTE_CATEGORY[r.wasteCategory] },
    { key: 'route', label: 'What happened to it', render: (r) => WASTE_ROUTE[r.treatmentRoute] || r.treatmentRoute, value: (r) => WASTE_ROUTE[r.treatmentRoute] },
    { key: 'qty', label: 'Weight (tonnes)', numeric: true, render: (r) => fmtNum(r.quantityMt, 3), value: (r) => r.quantityMt },
    { key: 'where', label: 'Handled', render: (r) => (r.isOnsite ? 'On site' : 'Taken away'), value: (r) => (r.isOnsite ? 'On site' : 'Taken away') },
    { key: 'ref', label: 'Manifest no.', render: (r) => r.manifestRef || '—', value: (r) => r.manifestRef },
    { key: 'status', label: 'Status', render: (r) => <span title={r.reviewNote || ''}><StatusBadge status={r.status} />{r.status === 'REJECTED' && r.reviewNote && <div className="text-xs text-danger-600 mt-0.5 max-w-[16rem] whitespace-normal">{r.reviewNote}</div>}</span>, value: (r) => r.status },
    { key: 'act', label: '', render: (r) => <RowActions kind="waste" row={r} onDone={refresh} /> }
  ], [refresh]);

  const ready = facilityId && periodId;
  return (
    <div>
      <PageHeader title="Water and waste" description="Record how much water your site used and what happened to its waste during the month. Your reviewer approves each record before it counts." />
      <ScopeBar scope={scope} hint="Choose the site and month these records belong to. Only months that are still open for data are shown." />

      {ready && draftCount > 0 && (
        <NextStep tone="warn" title={`${draftCount} ${tab} record${draftCount === 1 ? '' : 's'} not sent yet`}>
          Records stay as drafts until you send them for review. Use "Send for review" on each row below.
        </NextStep>
      )}

      <div role="tablist" className="flex gap-1 mb-4 border-b border-line">
        {[['water', 'Water', Droplets], ['waste', 'Waste', Recycle]].map(([k, label, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium -mb-px border-b-2 ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-muted hover:text-text'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'water' ? (
        <>
          <Card title="Add a water record" description="One record for each source of water for the month. Read the figures from your water meter, supply bill or tanker log.">
            <form onSubmit={saveWater} className="space-y-4">
              <FormGrid cols={3}>
                <SelectField label="Where does the water come from?" required value={w.withdrawalSource} onChange={(v) => setW({ ...w, withdrawalSource: v })} options={toOptions(enums.WaterSource, WATER_SOURCE)} hint="If you use more than one source, add one record for each." />
                <NumberField label="Water taken in" required unit="kL" min="0" placeholder="e.g. 1800" value={w.withdrawalKl} onChange={(v) => setW({ ...w, withdrawalKl: v })} hint="Total for the month. 1 kL = 1,000 litres = 1 cubic metre." />
                <NumberField label="Water sent out" unit="kL" min="0" placeholder="e.g. 380" value={w.dischargeKl} onChange={(v) => setW({ ...w, dischargeKl: v })} hint="Treated or untreated water that left the site. Leave blank if none." />
                <NumberField label="Water recycled or reused" unit="kL" min="0" placeholder="e.g. 120" value={w.recycledKl} onChange={(v) => setW({ ...w, recycledKl: v })} hint="Water you treated and used again inside the plant." optional />
                {discharging && <SelectField label="Where does the water you send out go?" required value={w.dischargeDestination} onChange={(v) => setW({ ...w, dischargeDestination: v })} placeholder="Choose where it goes" options={toOptions(enums.WaterDestination, WATER_DEST)} />}
                {discharging && !zld && <SelectField label="How is it treated before it leaves?" required value={w.treatmentLevel} onChange={(v) => setW({ ...w, treatmentLevel: v })} placeholder="Choose the treatment level" options={toOptions(rules.treatmentLevels, TREATMENT)} hint="Ask your environment or ETP team if you are not sure." />}
              </FormGrid>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-sm text-muted">{consumed === null ? 'Water used up will be calculated from what you enter.' : <>Water used up: <strong className="text-text tabular-nums">{fmtNum(consumed, 1)} kL</strong> (taken in minus sent out)</>}</p>
                <Button type="submit" loading={busy} disabled={!ready || w.withdrawalKl === ''}>Save as draft</Button>
              </div>
            </form>
          </Card>
          <div className="mt-4"><DataGrid endpoint="/resources/water" params={params} columns={waterCols} exportName="water-records" emptyTitle="No water records for this month yet" emptyText="Add your first record above. You can read the figures from your water meter or supply bill." /></div>
        </>
      ) : (
        <>
          <Card title="Add a waste record" description="One record for each type of waste and each way it was handled. Use your weighbridge slips or the waste handler's receipts.">
            <form onSubmit={saveWaste} className="space-y-4">
              <FormGrid cols={3}>
                <SelectField label="Type of waste" required value={ws.wasteCategory} onChange={(v) => setWs({ ...ws, wasteCategory: v })} placeholder="Choose the type" options={toOptions(enums.WasteCategory, WASTE_CATEGORY)} />
                <SelectField label="What happened to it?" required value={ws.treatmentRoute} onChange={(v) => setWs({ ...ws, treatmentRoute: v })} placeholder="Choose what happened" options={toOptions(enums.WasteRoute, WASTE_ROUTE)} />
                <NumberField label="Weight" required unit="tonnes" min="0" placeholder="e.g. 2.5" value={ws.quantityMt} onChange={(v) => setWs({ ...ws, quantityMt: v })} hint="Metric tonnes. 1 tonne = 1,000 kg." />
                <div className="flex items-end pb-2"><CheckField label="Handled on our site" checked={ws.isOnsite} onChange={(v) => setWs({ ...ws, isOnsite: v })} hint="Tick if it was treated or disposed of inside the plant." /></div>
                {needsManifest && <TextField className="sm:col-span-2" label="Manifest or tracking number" required placeholder="e.g. MH-2026-004512" value={ws.manifestRef} onChange={(v) => setWs({ ...ws, manifestRef: v })} hint="Hazardous waste taken off site travels with a manifest. The number is on your copy of the form." />}
              </FormGrid>
              <div className="flex justify-end pt-1"><Button type="submit" loading={busy} disabled={!ready || !ws.wasteCategory || !ws.treatmentRoute || ws.quantityMt === '' || (needsManifest && !ws.manifestRef.trim())}>Save as draft</Button></div>
            </form>
          </Card>
          <div className="mt-4"><DataGrid endpoint="/resources/waste" params={params} columns={wasteCols} exportName="waste-records" emptyTitle="No waste records for this month yet" emptyText="Add your first record above. Weighbridge slips and waste handler receipts have the weights." /></div>
        </>
      )}
    </div>
  );
}
