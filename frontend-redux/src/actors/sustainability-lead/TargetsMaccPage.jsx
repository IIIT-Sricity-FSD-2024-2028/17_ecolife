import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Plus } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { useOptions, toOptions } from '../../hooks/useOptions';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, Notice, PageHeader, StatusBadge } from '../../components/ui';
import { fmtInr, fmtNum } from '../../utils/formatters';
import { TargetPath } from '../../components/charts/Analytics';
import { TARGET_FRAMEWORK, TARGET_COVERAGE, TARGET_TYPE, LEVER, ACTION_STATUS, TARGET_STATUS } from '../../utils/labels';

const fyLabel = (y) => `FY${y}-${String((y + 1) % 100).padStart(2, '0')}`;
const thisFy = (() => { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; })();
const FY_OPTIONS = Array.from({ length: 16 }, (_, i) => { const l = fyLabel(thisFy - 5 + i); return { value: l, label: l }; });
const DOMAIN = { ELECTRICITY_THERMAL: 'Electricity', FUEL: 'Fuel', REFRIGERANT: 'Cooling gas', WATER: 'Water', WASTE: 'Waste', RAW_MATERIAL: 'Raw material' };
const n = (v) => (v === '' || v === undefined ? undefined : Number(v));

export default function TargetsMaccPage() {
  const dialog = useDialog();
  const { pushToast } = useToast();
  const send = useAction();
  const { enums } = useOptions();
  const { data: targets, refetch } = useApi('/targets');

  const actions = useMemo(() => (targets || []).flatMap((x) => (x.actions || []).map((a) => ({ ...a, targetName: x.name }))), [targets]);
  const macc = useMemo(() => actions.filter((a) => a.macInrPerTco2e != null).map((a) => ({ name: a.title.length > 20 ? `${a.title.slice(0, 19)}…` : a.title, mac: Number(a.macInrPerTco2e), saving: Number(a.netExpectedSavingTco2e || 0) })), [actions]);

  const call = (path, method, body, ok) => send({ path, method, body, toast: ok });

  async function addTarget() {
    const v = await dialog.form({ title: 'Set a reduction target', description: 'Pick a base year, a goal year and how much you want to cut. Yearly milestones are worked out for you.', submitLabel: 'Set target', wide: true, fields: [
      { name: 'name', type: 'text', label: 'Name', required: true, placeholder: 'e.g. Cut Scope 1 and 2 by 30% by 2030' },
      { name: 'framework', type: 'select', label: 'Which rules does it follow?', required: true, defaultValue: 'CUSTOM_INTERNAL', options: toOptions(enums.TargetFramework, TARGET_FRAMEWORK), hint: 'SBTi targets need at least 4.2% cut every year. This is checked when you save.' },
      { name: 'targetType', type: 'select', label: 'Measured as', required: true, defaultValue: 'ABSOLUTE', options: toOptions(enums.TargetType, TARGET_TYPE) },
      { name: 'scopeCoverage', type: 'select', label: 'What does it cover?', required: true, defaultValue: 'SCOPE_1_AND_2_LOCATION', options: toOptions(enums.TargetScopeCoverage, TARGET_COVERAGE) },
      { name: 'baseYear', type: 'select', label: 'Base year', required: true, defaultValue: fyLabel(thisFy - 1), options: FY_OPTIONS, hint: 'The year you measure the cut from.' },
      { name: 'targetYear', type: 'select', label: 'Goal year', required: true, defaultValue: fyLabel(thisFy + 4), options: FY_OPTIONS },
      { name: 'baseValue', type: 'number', label: 'Base year emissions', required: true, unit: 'tCO₂e', hint: 'If that year is already closed, this must match the closed figure.' },
      { name: 'targetReductionPct', type: 'number', label: 'How much to cut', required: true, unit: '%' },
      { name: 'intensityUnit', type: 'text', label: 'Per what? (only if measured per unit)', placeholder: 'e.g. tCO₂e per tonne of product' }] });
    if (!v) return;
    call('/targets', 'POST', { name: v.name.trim(), framework: v.framework, targetType: v.targetType, scopeCoverage: v.scopeCoverage, baseYear: v.baseYear, targetYear: v.targetYear, baseValue: Number(v.baseValue), targetReductionPct: Number(v.targetReductionPct), intensityUnit: v.targetType === 'INTENSITY' ? v.intensityUnit : undefined }, 'Target set with yearly milestones.');
  }

  async function evaluate(t) {
    const r = await call(`/targets/${t.id}/evaluate`, 'POST', {});
    if (r) pushToast(r.latest ? `Latest closed year ${r.latest.financialYear}: ${(TARGET_STATUS[r.status] || r.status).toLowerCase()} (${r.latest.variance > 0 ? '+' : ''}${r.latest.variance}% against plan).` : 'No fully closed year to judge yet.');
  }

  async function addProject(t) {
    const v = await dialog.form({ title: `Add a project to “${t.name}”`, description: 'We work out the cost of each tonne saved and the payback time.', submitLabel: 'Add project', wide: true, fields: [
      { name: 'title', type: 'text', label: 'Project', required: true, placeholder: 'e.g. 250 kW rooftop solar' },
      { name: 'lever', type: 'select', label: 'What kind of project?', required: true, options: toOptions(enums.ReductionLever, LEVER) },
      { name: 'domain', type: 'select', label: 'What does it change?', required: true, options: toOptions(enums.ResourceDomain?.filter((d) => DOMAIN[d]) || Object.keys(DOMAIN), DOMAIN) },
      { name: 'expectedSavingTco2e', type: 'number', label: 'Expected saving', required: true, unit: 'tCO₂e per year' },
      { name: 'secondaryScopeShiftTco2e', type: 'number', label: 'Emissions added elsewhere', unit: 'tCO₂e per year', hint: 'For example a fuel switch that raises electricity use. Leave empty if none.' },
      { name: 'capexInr', type: 'number', label: 'Cost to set up', unit: '₹' },
      { name: 'annualOpexDeltaInr', type: 'number', label: 'Change in yearly running cost', unit: '₹ per year', hint: 'Use a minus sign when it saves money.' },
      { name: 'lifetimeYears', type: 'number', label: 'Working life', required: true, unit: 'years' },
      { name: 'discountRatePct', type: 'number', label: 'Discount rate', unit: '%', hint: 'Leave empty for the standard rate.' },
      { name: 'endDate', type: 'date', label: 'Finish by', required: true }] });
    if (!v) return;
    call(`/targets/${t.id}/actions`, 'POST', { title: v.title.trim(), lever: v.lever, domain: v.domain, expectedSavingTco2e: Number(v.expectedSavingTco2e), secondaryScopeShiftTco2e: n(v.secondaryScopeShiftTco2e), capexInr: n(v.capexInr), annualOpexDeltaInr: n(v.annualOpexDeltaInr), lifetimeYears: Number(v.lifetimeYears), discountRatePct: n(v.discountRatePct), endDate: v.endDate }, 'Project added. Cost per tonne and payback worked out.');
  }

  async function updateProject(row) {
    const pick = await dialog.form({ title: `Update “${row.title}”`, submitLabel: 'Next', fields: [{ name: 'status', type: 'select', label: 'What happened?', required: true, defaultValue: 'IN_PROGRESS', options: ['IN_PROGRESS', 'DELAYED', 'COMPLETED', 'PARTIALLY_ACHIEVED', 'CANCELLED'].map((s) => ({ value: s, label: ACTION_STATUS[s] })) }] });
    if (!pick) return;
    const body = { status: pick.status };
    if (pick.status === 'DELAYED') { const v = await dialog.form({ title: 'Project delayed', submitLabel: 'Save', fields: [{ name: 'delayReason', type: 'textarea', label: 'Why is it delayed?', placeholder: 'e.g. The supplier delivered two months late.', required: true, minLength: 10 }, { name: 'revisedEndDate', type: 'date', label: 'New finish date', required: true }] }); if (!v) return; Object.assign(body, v); }
    if (pick.status === 'CANCELLED') { const v = await dialog.form({ title: 'Cancel project', danger: true, submitLabel: 'Cancel project', fields: [{ name: 'cancellationReason', type: 'textarea', label: 'Why is it cancelled?', placeholder: 'e.g. The budget moved to the solar project.', required: true, minLength: 10 }] }); if (!v) return; Object.assign(body, v); }
    if (['COMPLETED', 'PARTIALLY_ACHIEVED'].includes(pick.status)) { const v = await dialog.form({ title: 'Saving achieved', description: 'Use the checked saving, not the expected one.', submitLabel: 'Save', fields: [{ name: 'achieved', type: 'number', label: 'Saving achieved', unit: 'tCO₂e per year', required: true }] }); if (!v) return; body.achievedSavingTco2e = Number(v.achieved); }
    call(`/actions/${row.id}`, 'PATCH', body, 'Project updated.');
  }

  return (
    <div>
      <PageHeader title="Targets and projects" description="Where you want to get to, and the projects that get you there." actions={<Button onClick={addTarget}><Plus className="w-4 h-4" /> Set a target</Button>} />
      <Notice tone="info" className="mb-4">SBTi targets here follow the current SBTi rules (version 1): at least a 4.2% cut every year for Scope 1 and 2. The small company route is for independent companies with under 500 employees and under 10,000 tCO₂e of Scope 1 and location-based Scope 2. SBTi’s new version applies from 1 February 2027; we will update this page then.</Notice>
      {!targets ? <div className="h-32 animate-pulse" /> : targets.length === 0 ? <Card><EmptyState title="No target yet" action={<Button onClick={addTarget}>Set your first target</Button>}>A target gives your yearly figures something to be measured against.</EmptyState></Card> : (
        <div className="space-y-4">
          {targets.map((t) => (
            <Card key={t.id} title={t.name} description={`${t.baseYear} to ${t.targetYear} · cut ${t.targetReductionPct}% · ${TARGET_FRAMEWORK[t.framework] || ''}`}
              actions={<div className="flex gap-2 items-center"><StatusBadge status={t.status} label={TARGET_STATUS[t.status]} />{t.targetType === 'ABSOLUTE' && <Button size="sm" variant="secondary" onClick={() => evaluate(t)}>Check progress</Button>}<Button size="sm" onClick={() => addProject(t)}><Plus className="w-3.5 h-3.5" /> Project</Button></div>}>
              {Number(t.baseValue) > 0 && t.targetType === 'ABSOLUTE' && <div className="mb-4"><TargetPath target={{ name: t.name, baseYear: t.baseYear, targetYear: t.targetYear, baseValue: Number(t.baseValue), targetValue: Number(t.targetValue), intensityUnit: t.intensityUnit, milestones: (t.milestones || []).map((m) => ({ financialYear: m.financialYear, actual: (() => { const x = (t.progress || []).find((y) => y.financialYear === m.financialYear); return x?.complete ? x.actualValue : null; })() })) }} height={200} /></div>}
              {(t.milestones || []).length > 0 && <div className="overflow-x-auto -mx-1"><table className="w-full text-sm"><thead><tr className="text-left text-muted"><th className="py-1.5 px-1 font-medium">Year</th><th className="text-right font-medium">Plan (tCO₂e)</th><th className="text-right font-medium">Actual (tCO₂e)</th><th className="text-right font-medium">Against plan</th></tr></thead><tbody>
                {(t.milestones || []).map((m) => { const p = (t.progress || []).find((x) => x.financialYear === m.financialYear); return (
                  <tr key={m.id} className="border-t border-line"><td className="py-1.5 px-1">{m.financialYear}</td><td className="text-right tabular-nums">{fmtNum(m.plannedValue, 1)}</td><td className="text-right tabular-nums">{p?.actualValue != null ? `${fmtNum(p.actualValue, 1)}${p.complete ? '' : ` (${p.closedMonths} of 12 months)`}` : '–'}</td><td className="text-right tabular-nums">{p?.variance != null ? `${p.variance > 0 ? '+' : ''}${fmtNum(p.variance, 1)}%` : '–'}</td></tr>); })}
              </tbody></table></div>}
              {(t.actions || []).length > 0 && <ul className="mt-4 divide-y divide-line border-t border-line">{t.actions.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5"><div className="flex-1 min-w-[12rem]"><div className="font-medium">{a.title}</div><div className="text-sm text-muted">{LEVER[a.lever] || a.lever} · saves {fmtNum(a.netExpectedSavingTco2e, 1)} t a year{a.macInrPerTco2e != null ? ` · ${fmtInr(a.macInrPerTco2e)} per tonne` : ''}{Number(a.paybackYears) >= 0.1 ? ` · pays back in ${fmtNum(a.paybackYears, 1)} years` : (a.paybackYears != null && Number(a.capexInr) > 0 ? ' · pays back at once' : '')}</div></div><StatusBadge status={a.status} label={ACTION_STATUS[a.status]} />{!['COMPLETED', 'CANCELLED'].includes(a.status) && <Button size="sm" variant="secondary" onClick={() => updateProject(a)}>Update</Button>}</li>))}</ul>}
            </Card>
          ))}
          {macc.length > 0 && <Card title="Cost of each tonne saved" description="Bars below the line save you money as well as emissions.">
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={macc}><CartesianGrid strokeDasharray="3 3" stroke="#DDEFE6" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4B6359' }} /><YAxis tick={{ fontSize: 12, fill: '#4B6359' }} width={64} /><Tooltip formatter={(v) => [`₹${fmtNum(v, 0)} per tonne`, 'Cost']} /><ReferenceLine y={0} stroke="#10231C" /><Bar dataKey="mac" fill="#059669" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          </Card>}
        </div>)}
    </div>
  );
}
