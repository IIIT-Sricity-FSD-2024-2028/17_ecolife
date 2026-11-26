import React, { useEffect, useMemo } from 'react';
import { DOMAIN_LABEL } from '../../utils/labels';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from '../../hooks/useForm';
import { selectSavedViews, viewSaved, viewRemoved } from '../../store/slices/monthEnd/savedViewsSlice';
import { Link, useSearchParams } from 'react-router-dom';
import { BookmarkPlus, Download, X } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useOptions, toOptions } from '../../hooks/useOptions';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, PageHeader, SelectField } from '../../components/ui';
import { ShareBars } from '../../components/charts/Charts';
import { fmtInr, fmtNum } from '../../utils/formatters';

const GROUPS = [['scope', 'By scope'], ['site', 'By site'], ['month', 'By month'], ['source', 'By meter or source'], ['domain', 'By type']];
const SCOPE_LABEL = { SCOPE_1: 'Fuel burned on site (Scope 1)', SCOPE_2: 'Electricity bought (Scope 2)', SCOPE_3: 'Supply chain (Scope 3)', BIOGENIC: 'Biogenic (outside scopes)', NON_GHG: 'Not greenhouse gas' };
const STATUS_LABEL = { APPROVED: 'Approved only', SUBMITTED: 'Waiting for review', DRAFT: 'Drafts', ALL: 'Everything' };

/** Answers "where do our emissions come from?" by any cut. Every number reconciles with the month-end close. */
export default function ExplorerPage() {
  const [sp, setSp] = useSearchParams();
  const dialog = useDialog();
  const { enums } = useOptions();
  const { data: periods } = useApi('/periods');
  const { data: sites } = useApi('/facilities');
  const ui = useForm('explorer-ui', { showAll: false });
  const showAll = ui.values.showAll;
  const dispatch = useDispatch();
  const views = useSelector(selectSavedViews);

  const q = { groupBy: sp.get('groupBy') || 'scope', financialYear: sp.get('financialYear') || '', facilityId: sp.get('facilityId') || '', scope: sp.get('scope') || '', domain: sp.get('domain') || '', status: sp.get('status') || 'APPROVED', periodId: sp.get('periodId') || '' };
  const set = (patch) => { const n = new URLSearchParams(sp); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setSp(n, { replace: true }); };
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v)).toString();
  const { data, loading, error } = useApi(`/explorer?${qs}`);

  const years = useMemo(() => [...new Set((periods || []).map((p) => p.financialYear))].sort().reverse(), [periods]);
  const ranked = useMemo(() => (['site', 'source'].includes(q.groupBy) ? [...(data?.groups || [])].sort((a, b) => b.tco2e - a.tco2e) : data?.groups || []), [data, q.groupBy]);
  const shown = showAll || q.groupBy === 'month' ? ranked : ranked.slice(0, 12);
  const labelFor = (g) => (q.groupBy === 'scope' ? SCOPE_LABEL[g.key] || g.label : q.groupBy === 'domain' ? DOMAIN_LABEL[g.key] || g.label : g.label);
  const active = ['financialYear', 'facilityId', 'scope', 'domain', 'periodId'].filter((k) => q[k]);

  async function saveView() {
    const v = await dialog.form({ title: 'Save this view', description: 'Saved views stay in this browser so you can come back to the same cut in one click.', submitLabel: 'Save view', fields: [{ name: 'name', type: 'text', label: 'Name', placeholder: 'e.g. Diesel by site, this year', required: true, minLength: 3 }] });
    if (!v) return;
    dispatch(viewSaved({ name: v.name.trim(), qs }));
  }
  function exportCsv() {
    const esc = (v) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const rows = [['Group', 'Emissions (tCO2e)', 'Energy (GJ)', 'Cost (INR)', 'Records', 'Share (%)'], ...data.groups.map((g) => [labelFor(g), g.tco2e, g.energyGj, g.costInr, g.records, g.sharePct])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })); a.download = `emissions-by-${q.groupBy}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  useEffect(() => { document.title = 'Emissions explorer · Tropos'; }, []);

  return (
    <div>
      <PageHeader title="Emissions explorer" description="Pick how to slice your numbers. Select any row to narrow down to it."
        actions={<><Button variant="secondary" onClick={saveView}><BookmarkPlus className="w-4 h-4" /> Save view</Button><Button variant="secondary" onClick={exportCsv} disabled={!data?.groups?.length}><Download className="w-4 h-4" /> Download</Button></>} />

      <div className="card p-4 mb-4">
        <div role="tablist" aria-label="Group by" className="flex flex-wrap gap-1.5 mb-4">
          {GROUPS.map(([k, label]) => <button key={k} role="tab" aria-selected={q.groupBy === k} onClick={() => set({ groupBy: k })} className={`h-9 px-3.5 rounded-md text-sm font-medium border ${q.groupBy === k ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-text border-line-strong hover:bg-brand-50'}`}>{label}</button>)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <SelectField label="Financial year" value={q.financialYear} onChange={(v) => set({ financialYear: v })} placeholder="All years" options={years.map((y) => ({ value: y, label: y }))} />
          <SelectField label="Site" value={q.facilityId} onChange={(v) => set({ facilityId: v })} placeholder="All sites" options={(sites || []).map((s) => ({ value: s.id, label: s.name }))} />
          <SelectField label="Scope" value={q.scope} onChange={(v) => set({ scope: v })} placeholder="All scopes" options={toOptions(enums.EmissionScope, SCOPE_LABEL)} />
          <SelectField label="Type" value={q.domain} onChange={(v) => set({ domain: v })} placeholder="All types" options={toOptions(enums.ResourceDomain)} />
          <SelectField label="Records" value={q.status} onChange={(v) => set({ status: v })} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        </div>
        {(active.length > 0 || views.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {active.length > 0 && <button onClick={() => set(Object.fromEntries(active.map((k) => [k, ''])))} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><X className="w-3.5 h-3.5" />Clear filters</button>}
            {views.length > 0 && <span className="text-muted ml-2">Saved:</span>}
            {views.map((v) => <span key={v.name} className="inline-flex items-center rounded-md border border-line-strong bg-white">
              <button onClick={() => setSp(new URLSearchParams(v.qs))} className="px-2.5 h-8 hover:bg-brand-50 rounded-l-md">{v.name}</button>
              <button aria-label={`Remove saved view ${v.name}`} onClick={() => dispatch(viewRemoved(v.name))} className="px-1.5 h-8 text-muted hover:text-danger-600"><X className="w-3.5 h-3.5" /></button>
            </span>)}
          </div>
        )}
      </div>

      {error ? <div className="card p-6 text-sm text-danger-600">{error}</div> : loading && !data ? <div className="card h-64 animate-pulse" /> : data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-4">
            <div className="card p-4"><div className="text-sm text-muted">Total emissions</div><div className="mt-1 text-[1.5rem] sm:text-[1.75rem] leading-none font-semibold tabular-nums break-words">{fmtNum(data.total.tco2e)}<span className="ml-1.5 text-sm font-normal text-muted">tCO₂e</span></div></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4"><div className="text-sm text-muted">Energy</div><div className="mt-1 text-lg font-semibold tabular-nums">{fmtNum(data.total.energyGj, 0)} <span className="text-xs font-normal text-muted">GJ</span></div></div>
              <div className="card p-4"><div className="text-sm text-muted">Cost</div><div className="mt-1 text-lg font-semibold tabular-nums">{fmtInr(data.total.costInr)}</div></div>
            </div>
            <div className="card p-4 text-sm text-muted">{fmtNum(data.total.records, 0)} records · {STATUS_LABEL[data.status] || data.status}. Month-end totals use approved records only.</div>
          </div>
          <Card className="lg:col-span-2" title={GROUPS.find((g) => g[0] === q.groupBy)?.[1]} padded={data.groups.length > 0}>
            {data.groups.length === 0 ? <EmptyState title="Nothing matches these filters">Try a wider financial year, or choose “Everything” under Records to include drafts.</EmptyState> : (
              <div className="p-5 space-y-5">
                <ShareBars rows={shown.map((g) => ({ key: g.key, label: labelFor(g), value: g.tco2e, sub: `${fmtNum(g.records, 0)} ${g.records === 1 ? "record" : "records"} · ${fmtNum(g.energyGj, 0)} GJ · ${fmtInr(g.costInr)}` }))}
                  onPick={(r) => { const map = { scope: 'scope', site: 'facilityId', month: 'periodId', domain: 'domain' }; const f = map[q.groupBy]; if (f) set({ [f]: r.key }); }} />
                {shown.length < data.groups.length && <p className="text-xs text-muted">Showing the largest {shown.length} of {data.groups.length}. <button type="button" className="text-brand-700 hover:underline" onClick={() => ui.set('showAll', true)}>Show all {data.groups.length}</button> or download the full list.</p>}
                {showAll && data.groups.length > 12 && <p className="text-xs text-muted"><button type="button" className="text-brand-700 hover:underline" onClick={() => ui.set('showAll', false)}>Show only the largest 12</button></p>}
                {(q.groupBy === 'month' || q.groupBy === 'site') && <p className="text-xs text-muted">Want the individual records? <Link className="text-brand-700 hover:underline" to="/sustainability/review">Open the review list</Link>.</p>}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
