import React, { useCallback, useMemo, useRef } from 'react';
import { Pencil, Trash2, TriangleAlert } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useForm } from '../../hooks/useForm';
import { useApi } from '../../hooks/useApi';
import { useOptions } from '../../hooks/useOptions';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, CheckField, FormGrid, NextStep, NumberField, SelectField, StatusBadge, TextField } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { ScopeBar, useReportingScope } from '../../components/dataEntry/ReportingScope';
import { OcrBillUploader } from '../../components/dataEntry/OcrBillUploader';
import { fmtInr, fmtNum } from '../../utils/formatters';
import { describeFlag, findUnit, isAnomaly } from '../../utils/labels';
import { useAuth } from '../../context/AuthContext';

const EMPTY = { sourceId: '', rawQuantity: '', rawUnit: '', costInr: '', invoiceNumber: '', evidenceFileId: '', opening: '', purchased: '', closing: '' };

/** Lets someone add the bill or certificate to a record that was saved without one. */
function AttachBill({ entry }) {
  const ref = useRef(null);
  const send = useAction();
  const f = useForm(`attach-bill-${entry.id}`, { busy: false });
  async function pick(file) {
    if (!file) return;
    f.set('busy', true);
    const fd = new FormData(); fd.append('file', file); fd.append('entryId', entry.id);
    await send({ path: '/evidence/upload', method: 'POST', form: fd, toast: 'Bill attached.' });
    f.set('busy', false); if (ref.current) ref.current.value = '';
  }
  return <>
    <input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" aria-label={`Choose the bill for ${entry.source?.name || 'this record'}`} onChange={(e) => pick(e.target.files?.[0])} />
    <Button size="sm" variant="secondary" loading={f.values.busy} onClick={() => ref.current?.click()}>Attach bill</Button>
  </>;
}

export default function FuelsEnergyPage() {
  const { pushToast } = useToast();
  const send = useAction();
  const dialog = useDialog();
  const { user } = useAuth();
  const { rules } = useOptions();
  const scope = useReportingScope();
  const { data: allSources } = useApi('/sources');
  const form = useForm('fuels-energy', { ...EMPTY, tank: false, busy: false, status: '' });
  const f = form.values;
  const { tank, busy, status } = f;
  const canReview = (user?.roles || []).some((r) => ['SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER'].includes(r));

  const sources = useMemo(() => (allSources || []).filter((s) => s.facilityId === scope.facilityId && ['FUEL', 'ELECTRICITY_THERMAL'].includes(s.domain)
    && (!scope.period || (new Date(s.effectiveFrom) <= new Date(scope.period.endDate) && (!s.effectiveTo || new Date(s.effectiveTo) >= new Date(scope.period.startDate))))), [allSources, scope.facilityId, scope.period]);
  const source = sources.find((s) => s.id === f.sourceId);
  const units = rules.units || [];
  const dimOf = (u) => findUnit(units, u)?.dimension;
  const unitChoices = source ? units.filter((u) => u.dimension === dimOf(source.canonicalUnit)).map((u) => ({ value: u.key, label: u.label })) : [];
  const set = (k) => (v) => form.set(k, v);
  const pickSource = (id) => { const s = sources.find((x) => x.id === id); form.patch({ sourceId: id, rawUnit: s ? (findUnit(units, s.canonicalUnit)?.key || s.canonicalUnit) : '' }); };

  const onOcr = useCallback((res) => {
    const ex = res.extracted;
    form.patch({ ...(ex.quantity != null ? { rawQuantity: String(ex.quantity) } : {}), ...(ex.unit && findUnit(units, ex.unit) ? { rawUnit: findUnit(units, ex.unit).key } : {}), ...(ex.costInr != null ? { costInr: String(ex.costInr) } : {}), ...(ex.invoiceNumber ? { invoiceNumber: ex.invoiceNumber } : {}), ...(res.evidence?.id ? { evidenceFileId: res.evidence.id } : {}) });
  }, [units]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault(); form.set('busy', true);
    const created = await send({ path: '/entries', method: 'POST', body: { periodId: scope.periodId, sourceId: f.sourceId, rawQuantity: Number(f.rawQuantity), rawUnit: f.rawUnit, costInr: f.costInr ? Number(f.costInr) : undefined, invoiceNumber: f.invoiceNumber.trim() || undefined, evidenceFileId: f.evidenceFileId || undefined,
      ...(tank ? { openingStockQty: Number(f.opening || 0), purchasedQty: Number(f.purchased || 0), closingStockQty: Number(f.closing || 0) } : {}) } });
    if (created) {
      const flags = (created.qualityFlags || []).filter(isAnomaly);
      pushToast(flags.length ? `Saved as a draft. Note: ${flags.map(describeFlag).join('; ')}.` : `Saved as a draft: ${fmtNum(created.calculatedTco2eAr6, 3)} tCO₂e.`);
      form.reset({ ...EMPTY, sourceId: f.sourceId, rawUnit: f.rawUnit, tank: false, busy: false, status });
    } else form.set('busy', false);
  }
  const act = (path, method, okMsg, body) => send({ path, method, body, toast: okMsg });
  async function edit(r) {
    const v = await dialog.form({ title: 'Change this draft', description: `${r.source?.name}, ${r.period?.label}. The emissions are worked out again when you save.`, submitLabel: 'Save changes', fields: [
      { name: 'q', type: 'number', label: `Amount (${r.rawUnit})`, required: true, defaultValue: String(r.rawQuantity) }, { name: 'c', type: 'number', label: 'Cost (₹)', optional: true, defaultValue: r.costInr ? String(r.costInr) : '' }] });
    if (v) act(`/entries/${r.id}`, 'PATCH', 'Draft updated.', { rawQuantity: Number(v.q), costInr: v.c ? Number(v.c) : undefined });
  }
  async function remove(r) { if (await dialog.confirm({ title: 'Delete this draft?', message: 'It will be removed. This cannot be undone.', confirmLabel: 'Delete draft', danger: true })) act(`/entries/${r.id}`, 'DELETE', 'Draft deleted.'); }

  const columns = useMemo(() => [
    { key: 's', label: 'Meter or source', render: (r) => <><div className="font-medium">{r.source?.name}</div><div className="text-xs text-muted">{r.period?.label}{r.invoiceNumber ? ` · bill ${r.invoiceNumber}` : ''}</div></>, value: (r) => r.source?.name },
    { key: 'q', label: 'Amount', numeric: true, render: (r) => `${fmtNum(r.normalizedQuantity)} ${r.normalizedUnit}`, value: (r) => `${r.normalizedQuantity} ${r.normalizedUnit}` },
    { key: 'e', label: 'Emissions (tCO₂e)', numeric: true, render: (r) => fmtNum(r.calculatedTco2eAr6, 3), value: (r) => r.calculatedTco2eAr6 },
    { key: 'c', label: 'Cost (₹)', numeric: true, render: (r) => (r.costInr ? fmtInr(r.costInr) : '—'), value: (r) => r.costInr },
    { key: 'k', label: 'Checks', render: (r) => { const a = (r.qualityFlags || []).filter(isAnomaly); return a.length ? <span className="inline-flex gap-1.5 text-saffron-600 text-sm"><TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />{a.map(describeFlag).join('; ')}</span> : <span className="text-subtle">None</span>; }, value: (r) => (r.qualityFlags || []).map(describeFlag).join('; ') },
    { key: 'st', label: 'Status', render: (r) => <span title={r.reviewNote || ''}><StatusBadge status={r.status} />{r.status === 'REJECTED' && r.reviewNote && <div className="text-xs text-danger-600 mt-0.5 max-w-[16rem] whitespace-normal">{r.reviewNote}</div>}</span>, value: (r) => r.status },
    { key: 'a', label: '', render: (r) => {
      const mine = ['DRAFT', 'REJECTED'].includes(r.status);
      return <div className="flex gap-1 justify-end">
        {mine && <Button size="sm" onClick={() => act(`/entries/${r.id}/submit`, 'POST', 'Sent for review.')}>Send for review</Button>}
        {mine && <Button size="sm" variant="ghost" aria-label="Change draft" onClick={() => edit(r)}><Pencil className="w-4 h-4" /></Button>}
        {mine && <Button size="sm" variant="ghost" aria-label="Delete draft" onClick={() => remove(r)}><Trash2 className="w-4 h-4" /></Button>}
        {(r.evidenceFiles || []).length === 0 ? <AttachBill entry={r} /> : <span className="text-xs text-muted self-center px-1">Bill attached</span>}
        {r.status === 'SUBMITTED' && canReview && <Button size="sm" variant="secondary" onClick={() => window.location.assign('/sustainability/review')}>Open in Review</Button>}
      </div>; } }
  ], [canReview]); // eslint-disable-line

  const params = { facilityId: scope.facilityId, periodId: scope.periodId, status };
  // fuel and electricity only; cooling-gas records live on their own screen
  const ready = scope.periodId && f.sourceId && f.rawQuantity !== '' && f.rawUnit;
  return (
    <div>
      <div className="mb-5"><h1 className="text-[1.5rem] font-semibold">Energy and fuel</h1><p className="text-muted mt-1">Record each electricity bill and fuel purchase for the month. Records stay as drafts until you send them for review.</p></div>
      <ScopeBar scope={scope} />
      {scope.months.length === 0 && !scope.loading && <NextStep tone="warn" title="No open month for this site">Ask a sustainability lead to open the month in Month-end close.</NextStep>}
      <Card title="Add a record" description="One record for each bill or each fuel delivery.">
        <div className="space-y-4">
          <OcrBillUploader onExtracted={onOcr} />
          <form onSubmit={save} className="space-y-4">
            <FormGrid cols={3}>
              <SelectField className="sm:col-span-2" label="Which meter or fuel?" required value={f.sourceId} onChange={pickSource} placeholder={sources.length ? 'Choose a meter or fuel' : 'No meters set up for this site'} options={sources.map((s) => ({ value: s.id, label: `${s.name}` }))} hint="Meters and fuels are set up in Sites and emission factors." />
              <TextField label="Bill number" optional placeholder="e.g. BPCL-2026-4410" value={f.invoiceNumber} onChange={set('invoiceNumber')} hint="Checked so the same bill is not entered twice." />
              <NumberField label="Amount used" required min="0" placeholder={source ? `e.g. 1200` : ''} value={f.rawQuantity} onChange={set('rawQuantity')} hint="Read it from the bill or meter. Enter the real figure, not an estimate." />
              <SelectField label="Unit" required value={f.rawUnit} onChange={set('rawUnit')} placeholder="Choose a meter first" options={unitChoices} hint="Pick the unit printed on the bill." />
              <NumberField label="Cost" optional unit="₹" min="0" placeholder="e.g. 126960" value={f.costInr} onChange={set('costInr')} hint="Total paid including tax." />
            </FormGrid>
            <CheckField label="This fuel is stored in a tank, and I know the opening and closing stock" checked={tank} onChange={(v) => form.set('tank', v)} />
            {tank && <FormGrid cols={3}>
              <NumberField label="Stock at start of month" min="0" value={f.opening} onChange={set('opening')} /><NumberField label="Bought this month" min="0" value={f.purchased} onChange={set('purchased')} /><NumberField label="Stock at end of month" min="0" value={f.closing} onChange={set('closing')} />
            </FormGrid>}
            <div className="flex justify-end"><Button type="submit" loading={busy} disabled={!ready}>Save as draft</Button></div>
          </form>
        </div>
      </Card>
      <div className="mt-4"><DataGrid endpoint="/entries" params={params} columns={columns} exportName="energy-and-fuel"
        toolbar={<SelectField className="w-52" label="" aria-label="Show" value={status} onChange={(v) => form.set('status', v)} placeholder="All records" options={[{ value: 'DRAFT', label: 'Drafts' }, { value: 'SUBMITTED', label: 'Waiting for review' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Sent back' }]} />}
        emptyTitle="No records for this month yet" emptyText="Add your first record above. Electricity bills and fuel invoices are the usual place to start." /></div>
    </div>
  );
}
