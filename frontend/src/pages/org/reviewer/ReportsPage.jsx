import { Fragment, useState } from 'react';
import { useZodForm } from '../../../hooks/useZodForm';
import { overrideFactorSchema } from '../../../schemas/formSchemas';
import { BarChart3, FlaskConical, Leaf, Wallet, CheckCircle2, TrendingUp, Building, GitFork, Eye, EyeOff, Plus, X, SearchX } from 'lucide-react';
import { Card, CardHeader } from '../../../components/ui/Card';
import { SummaryCard } from '../../../components/ui/SummaryCard';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { BarChart, ProgressBar } from '../../../components/ui/charts';
import { FormField, TextInput, Select, TextArea } from '../../../components/ui/FormField';
import { EmptyState } from '../../../components/shared/EmptyState';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useEmissions, useFactorSources, useFactorVersions, useCreateFactorOverride } from '../../../hooks/useRoleData';
import { useResourceTypes } from '../../../hooks/useResourceRecords';
import { useDepartments } from '../../../hooks/useOrgData';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtCo2e, fmtDate, fmtMonth, fmtMoney, fmtNumber, fmtRange, isoToday } from '../../../utils/format';

export function EmissionsAnalysisPage() {
  const [tab, setTab] = useState('analysis');
  return (
    <div>
      <PageHeader subtitle="Approved emissions by month and department, measured against targets, with full factor lineage." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'analysis', label: 'Analysis', icon: BarChart3 }, { value: 'methodology', label: 'Methodology & Factors', icon: FlaskConical }]} />
      {tab === 'analysis' ? <Analysis /> : <Methodology />}
    </div>
  );
}

function Analysis() {
  const { data: departments = [] } = useDepartments();
  const [filters, setFilters] = useState({ from: '', to: '', departmentId: '' });
  const { data, isLoading } = useEmissions(filters);
  const [openLineage, setOpenLineage] = useState(null);
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="stack">
      <div className="filters" style={{ marginBottom: 0 }}>
        <FormField label="From"><TextInput type="date" value={filters.from} onChange={set('from')} /></FormField>
        <FormField label="To"><TextInput type="date" value={filters.to} onChange={set('to')} /></FormField>
        <FormField label="Department">
          <Select value={filters.departmentId} onChange={set('departmentId')}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </FormField>
      </div>

      {isLoading || !data ? <p className="text-muted">Loading…</p> : data.totals.entries === 0 ? (
        <Card><EmptyState icon={SearchX} title="No approved data in this range" description="Emissions appear here once entries are approved and calculated." /></Card>
      ) : (
        <>
          <div className="summary-grid" style={{ marginBottom: 0 }}>
            <SummaryCard icon={Leaf} label="Total emissions" value={fmtCo2e(data.totals.co2eKg)} />
            <SummaryCard icon={Wallet} label="Total cost" value={fmtMoney(data.totals.cost)} />
            <SummaryCard icon={CheckCircle2} label="Approved entries" value={data.totals.entries} />
          </div>

          <Card>
            <CardHeader icon={TrendingUp} title="Emissions trend" subtitle="kg CO₂e by period start month" />
            <BarChart data={data.trend.map((t) => ({ label: fmtMonth(t.month), value: t.co2eKg }))} format={(v) => `${fmtNumber(v, 1)} kg`} />
          </Card>

          <Card padded={false}>
            <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}><CardHeader icon={Building} title="Department performance vs. target" /></div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Department</th><th className="num">Emissions</th><th className="num">Cost</th><th>Target</th><th className="num">Actual / target</th><th>Progress</th></tr></thead>
                <tbody>
                  {data.departments.map((d) =>
                    d.targets.length === 0 ? (
                      <tr key={d.departmentId}><td>{d.name}</td><td className="num">{fmtNumber(d.co2eKg, 1)} kg</td><td className="num">{fmtMoney(d.cost)}</td><td colSpan={3} className="text-muted">No target set</td></tr>
                    ) : (
                      d.targets.map((t, i) => (
                        <tr key={`${d.departmentId}-${t.id}`}>
                          <td>{i === 0 ? d.name : ''}</td>
                          <td className="num">{i === 0 ? `${fmtNumber(d.co2eKg, 1)} kg` : ''}</td>
                          <td className="num">{i === 0 ? fmtMoney(d.cost) : ''}</td>
                          <td>{t.resourceCategory ?? 'All'} · {t.metric}<br /><span className="text-muted">{fmtRange(t.periodStart, t.periodEnd)}</span></td>
                          <td className="num">{fmtNumber(t.actual, 1)} / {fmtNumber(t.targetValue, 1)}</td>
                          <td><ProgressBar percent={t.percentOfTarget} /></td>
                        </tr>
                      ))
                    ),
                  )}
                  {data.orgTargets.map((t) => (
                    <tr key={`org-${t.id}`}>
                      <td><strong>Organization-wide</strong></td><td className="num">{fmtCo2e(data.totals.co2eKg)}</td><td className="num">{fmtMoney(data.totals.cost)}</td>
                      <td>{t.resourceCategory ?? 'All'} · {t.metric}<br /><span className="text-muted">{fmtRange(t.periodStart, t.periodEnd)}</span></td>
                      <td className="num">{fmtNumber(t.actual, 1)} / {fmtNumber(t.targetValue, 1)}</td>
                      <td><ProgressBar percent={t.percentOfTarget} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card padded={false}>
            <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}>
              <CardHeader icon={GitFork} title="Calculation lineage" subtitle="Trace any figure back to the emission factor version that produced it." />
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Period</th><th>Department</th><th>Resource</th><th className="num">Activity</th><th className="num">Emissions</th><th></th></tr></thead>
                <tbody>
                  {data.lineage.map((l) => (
                    <Fragment key={l.recordId}>
                      <tr>
                        <td>{fmtRange(l.periodStart, l.periodEnd)}</td>
                        <td>{l.departmentName}</td>
                        <td>{l.resourceTypeName}</td>
                        <td className="num">{fmtNumber(l.quantity, 2)} {l.unit}</td>
                        <td className="num">{fmtCo2e(l.co2eKg)}</td>
                        <td><Button variant="ghost" size="sm" icon={openLineage === l.recordId ? EyeOff : Eye} onClick={() => setOpenLineage(openLineage === l.recordId ? null : l.recordId)}>{openLineage === l.recordId ? 'Hide' : 'Show'} factors</Button></td>
                      </tr>
                      {openLineage === l.recordId && (
                        <tr>
                          <td colSpan={6}>
                            <div className="lineage">
                              <p style={{ margin: '0 0 var(--space-2)' }}>
                                <StatusBadge status={l.factorScope === 'ORG_OVERRIDE' ? 'PENDING_APPROVAL' : 'APPROVED'} label={l.factorScope === 'ORG_OVERRIDE' ? 'Organization override' : 'Global default'} />
                                {l.recalculatedCount > 0 && <span className="text-muted"> · recalculated {l.recalculatedCount}×</span>}
                              </p>
                              {l.factors.map((f) => (
                                <p key={f.id} style={{ margin: '2px 0' }}>
                                  <code>{fmtNumber(l.quantity, 4)} {l.unit} × {f.factorValue} {f.unit} × GWP {f.gwp} ({f.gas})</code> = {fmtCo2e(f.contributionKg)} <span className="text-muted">· {f.sourceName}, effective {fmtDate(f.effectiveFrom)}</span>
                                </p>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Methodology() {
  const { data: types = [] } = useResourceTypes();
  const { data: sources = [] } = useFactorSources();
  const [typeId, setTypeId] = useState('');
  const { data: versions = [] } = useFactorVersions(typeId);
  const create = useCreateFactorOverride();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useZodForm(overrideFactorSchema, { sourceId: '', gas: 'CO2', factorValue: '', gwp: '1', unit: '', effectiveFrom: isoToday(), notes: '' });

  const sourceName = (id) => sources.find((s) => s.id === id)?.name ?? '—';

  const onSubmit = async (v) => {
    const typeName = types.find((t) => t.id === typeId)?.name ?? 'this resource type';
    const ok = await confirm({
      title: `Add an override factor for ${typeName}?`,
      message: 'It takes precedence over the global factor for periods on or after its effective date, and locks once a calculation uses it.',
      confirmLabel: 'Create override',
      icon: FlaskConical,
    });
    if (!ok) return;
    try {
      await create.mutateAsync({ resourceTypeId: typeId, sourceId: v.sourceId, gas: v.gas.trim(), factorValue: Number(v.factorValue), gwp: Number(v.gwp), unit: v.unit.trim(), effectiveFrom: v.effectiveFrom, notes: v.notes.trim() });
      showToast('Override factor created.', 'success');
      reset();
      setShowForm(false);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
    }
  };

  return (
    <Card>
      <CardHeader icon={FlaskConical} title="Emission factors" subtitle="Global defaults are maintained by the platform. You can add an organization-specific override that takes precedence for periods on or after its effective date." />
      <FormField label="Resource type">
        <Select value={typeId} onChange={(e) => { setTypeId(e.target.value); setShowForm(false); }}>
          <option value="">Select a resource type…</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </FormField>

      {typeId && (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Scope</th><th>Gas</th><th className="num">Factor</th><th className="num">GWP</th><th>Source</th><th>Effective from</th><th>State</th><th>Why / reference</th></tr></thead>
              <tbody>
                {versions.length === 0 && <tr><td colSpan={8} className="text-muted">No factors defined for this resource type.</td></tr>}
                {versions.map((f) => (
                  <tr key={f.id}>
                    <td>{f.organizationId ? 'Your override' : 'Global'}</td>
                    <td>{f.gas}</td>
                    <td className="num">{f.factorValue} <span className="text-muted">{f.unit}</span></td>
                    <td className="num">{f.gwp}</td>
                    <td>{sourceName(f.sourceId)}</td>
                    <td>{fmtDate(f.effectiveFrom)}</td>
                    <td>{f.isLocked ? 'In use (locked)' : 'Unused'}</td>
                    <td className="text-muted" style={{ maxWidth: 280 }}>{f.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 'var(--space-4)' }}>
            {!showForm ? (
              <Button variant="secondary" icon={Plus} onClick={() => setShowForm(true)}>Add override factor</Button>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <h3 className="section-title" style={{ marginTop: 0 }}>New organization override</h3>
                <div className="callout">Factors already used in a calculation are locked and never edited. A new factor applies to entries calculated after it — recalculate approved entries from Submissions to apply it to existing data.</div>
                <div className="split-2">
                  <FormField label="Source" error={errors.sourceId} required>
                    <Select error={errors.sourceId} {...register('sourceId')}>
                      <option value="">Select a source…</option>
                      {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                  </FormField>
                  <FormField label="Gas" error={errors.gas} required>
                    <TextInput placeholder="CO2" error={errors.gas} {...register('gas')} />
                  </FormField>
                  <FormField label="Factor value" error={errors.factorValue} required>
                    <TextInput type="number" inputMode="decimal" step="any" min="0" placeholder="0.82" error={errors.factorValue} {...register('factorValue')} />
                  </FormField>
                  <FormField label="GWP" error={errors.gwp} required>
                    <TextInput type="number" inputMode="decimal" step="any" min="0" placeholder="1" error={errors.gwp} {...register('gwp')} />
                  </FormField>
                  <FormField label="Factor unit" error={errors.unit} required>
                    <TextInput placeholder="kg CO2 per kWh" error={errors.unit} {...register('unit')} />
                  </FormField>
                  <FormField label="Effective from" error={errors.effectiveFrom} required>
                    <TextInput type="date" error={errors.effectiveFrom} {...register('effectiveFrom')} />
                  </FormField>
                </div>
                <FormField label="Why this override is needed" required error={errors.notes} hint="Auditors will ask. Name the supplier, certificate or study the factor comes from.">
                  <TextArea rows={3} maxLength={500} placeholder="e.g. Supplier-specific grid mix, certificate no. 2026-114 from GreenGrid Ltd." error={errors.notes} {...register('notes')} />
                </FormField>
                <div className="row-actions">
                  <Button type="submit" icon={Plus} loading={create.isPending}>Create override</Button>
                  <Button variant="ghost" icon={X} onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
