import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useZodForm } from '../../../hooks/useZodForm';
import { overrideFactorSchema } from '../../../schemas/formSchemas';
import { BarChart3, FlaskConical, Leaf, Wallet, CheckCircle2, TrendingUp, Building, GitFork, Eye, EyeOff, Plus, X, SearchX, ChevronLeft, ChevronRight, PieChart, ArrowRight, ExternalLink } from 'lucide-react';
import { Card, CardHeader } from '../../../components/ui/Card';
import { SummaryCard } from '../../../components/ui/SummaryCard';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { Drawer } from '../../../components/ui/Drawer';
import { DetailList } from '../../../components/shared/DetailList';
import { rowProps } from '../../../components/shared/rowProps';
import { REVIEWER_ROUTES } from '../../../constants/routes';
import { BarChart, AreaChart, DonutChart, Sparkline, ProgressBar } from '../../../components/ui/charts';
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

const LINEAGE_PAGE = 10;
const FACTOR_PAGE = 10;

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
  const [selectedLineage, setSelectedLineage] = useState(null);
  const [lineageOffset, setLineageOffset] = useState(0);
  const [trendMetric, setTrendMetric] = useState('emissions'); // 'emissions' | 'cost'
  const [chartType, setChartType] = useState('bar'); // 'bar' | 'area'
  const [donutMetric, setDonutMetric] = useState('emissions'); // 'emissions' | 'cost'
  const set = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setLineageOffset(0);
  };

  const lineage = data?.lineage ?? [];
  const lineageTotal = lineage.length;
  const pagedLineage = lineage.slice(lineageOffset, lineageOffset + LINEAGE_PAGE);

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
            <SummaryCard icon={Leaf} label="Total emissions" value={fmtCo2e(data.totals.co2eKg)}>
              <Sparkline data={data.trend.map((t) => t.co2eKg)} color="var(--color-primary, #1f6f4f)" />
            </SummaryCard>
            <SummaryCard icon={Wallet} label="Total cost" value={fmtMoney(data.totals.cost)}>
              <Sparkline data={data.trend.map((t) => t.cost)} color="#0284c7" />
            </SummaryCard>
            <SummaryCard icon={CheckCircle2} label="Approved entries" value={data.totals.entries} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 'var(--space-4)' }}>
            <Card>
              <CardHeader
                icon={TrendingUp}
                title="Monthly trajectory"
                subtitle={trendMetric === 'emissions' ? 'Approved emissions by month' : 'Approved spend by month'}
                actions={
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: 2, background: 'var(--color-bg)', padding: 2, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                      <Button
                        size="sm"
                        variant={trendMetric === 'emissions' ? 'primary' : 'ghost'}
                        onClick={() => setTrendMetric('emissions')}
                      >
                        Emissions
                      </Button>
                      <Button
                        size="sm"
                        variant={trendMetric === 'cost' ? 'primary' : 'ghost'}
                        onClick={() => setTrendMetric('cost')}
                      >
                        Cost ($)
                      </Button>
                    </div>
                    <div style={{ display: 'inline-flex', gap: 2, background: 'var(--color-bg)', padding: 2, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                      <Button
                        size="sm"
                        variant={chartType === 'bar' ? 'secondary' : 'ghost'}
                        onClick={() => setChartType('bar')}
                        title="Bar chart view"
                      >
                        <BarChart3 size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant={chartType === 'area' ? 'secondary' : 'ghost'}
                        onClick={() => setChartType('area')}
                        title="Spline area view"
                      >
                        <TrendingUp size={14} />
                      </Button>
                    </div>
                  </div>
                }
              />
              {chartType === 'bar' ? (
                <BarChart
                  data={data.trend.map((t) => ({
                    label: fmtMonth(t.month),
                    value: trendMetric === 'emissions' ? t.co2eKg : t.cost,
                  }))}
                  format={trendMetric === 'emissions' ? (v) => fmtCo2e(v) : (v) => fmtMoney(v)}
                  formatYAxis={
                    trendMetric === 'emissions'
                      ? (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)}kg`)
                      : (v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${Math.round(v)}`)
                  }
                />
              ) : (
                <AreaChart
                  data={data.trend.map((t) => ({
                    label: fmtMonth(t.month),
                    value: trendMetric === 'emissions' ? t.co2eKg : t.cost,
                  }))}
                  format={trendMetric === 'emissions' ? (v) => fmtCo2e(v) : (v) => fmtMoney(v)}
                  formatYAxis={
                    trendMetric === 'emissions'
                      ? (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)}kg`)
                      : (v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${Math.round(v)}`)
                  }
                />
              )}
            </Card>

            <Card>
              <CardHeader
                icon={PieChart}
                title="Department distribution"
                subtitle={donutMetric === 'emissions' ? 'Share of approved emissions' : 'Share of approved spend'}
                actions={
                  <div style={{ display: 'inline-flex', gap: 2, background: 'var(--color-bg)', padding: 2, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <Button
                      size="sm"
                      variant={donutMetric === 'emissions' ? 'primary' : 'ghost'}
                      onClick={() => setDonutMetric('emissions')}
                    >
                      Emissions
                    </Button>
                    <Button
                      size="sm"
                      variant={donutMetric === 'cost' ? 'primary' : 'ghost'}
                      onClick={() => setDonutMetric('cost')}
                    >
                      Cost ($)
                    </Button>
                  </div>
                }
              />
              <DonutChart
                data={data.departments.map((d) => ({
                  label: d.name,
                  value: donutMetric === 'emissions' ? d.co2eKg : d.cost,
                }))}
                format={donutMetric === 'emissions' ? (v) => fmtCo2e(v) : (v) => fmtMoney(v)}
              />
            </Card>
          </div>

          <Card padded={false}>
            <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}><CardHeader icon={Building} title="Department performance vs. target" /></div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Department</th><th className="num">Emissions</th><th className="num">Cost</th><th>Target</th><th className="num">Actual / target</th><th>Progress</th></tr></thead>
                <tbody>
                  {data.departments.map((d) =>
                    d.targets.length === 0 ? (
                      <tr key={d.departmentId}><td>{d.name}</td><td className="num">{fmtCo2e(d.co2eKg)}</td><td className="num">{fmtMoney(d.cost)}</td><td colSpan={3} className="text-muted">No target set</td></tr>
                    ) : (
                      d.targets.map((t, i) => (
                        <tr key={`${d.departmentId}-${t.id}`}>
                          <td>{i === 0 ? d.name : ''}</td>
                          <td className="num">{i === 0 ? fmtCo2e(d.co2eKg) : ''}</td>
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
              <CardHeader icon={GitFork} title="Calculation lineage" subtitle={`Trace any figure back to the emission factor version that produced it.${lineageTotal > 0 ? ` (${lineageTotal} entries)` : ''}`} />
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Period</th><th>Department</th><th>Resource</th><th className="num">Activity</th><th className="num">Emissions</th><th></th></tr></thead>
                <tbody>
                  {pagedLineage.map((l) => (
                    <tr key={l.recordId} {...rowProps(() => setSelectedLineage(l))}>
                      <td>{fmtRange(l.periodStart, l.periodEnd)}</td>
                      <td>{l.departmentName}</td>
                      <td>{l.resourceTypeName}</td>
                      <td className="num">{fmtNumber(l.quantity, 2)} {l.unit}</td>
                      <td className="num">{fmtCo2e(l.co2eKg)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="link-button inline-icon">
                          View lineage <ArrowRight size={13} aria-hidden="true" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {lineageTotal > LINEAGE_PAGE && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--color-border)' }}>
                <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                  Showing {lineageOffset + 1}–{Math.min(lineageOffset + LINEAGE_PAGE, lineageTotal)} of {lineageTotal}
                </span>
                <div className="row-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ChevronLeft}
                    disabled={lineageOffset === 0}
                    onClick={() => setLineageOffset(Math.max(0, lineageOffset - LINEAGE_PAGE))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={lineageOffset + LINEAGE_PAGE >= lineageTotal}
                    onClick={() => setLineageOffset(lineageOffset + LINEAGE_PAGE)}
                  >
                    Next <ChevronRight size={14} aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {selectedLineage && (
            <LineageDrawer
              item={selectedLineage}
              onClose={() => setSelectedLineage(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

function LineageDrawer({ item: l, onClose }) {
  if (!l) return null;
  return (
    <Drawer
      open
      title={`${l.resourceTypeName} Calculation Lineage`}
      subtitle={`${l.departmentName} · ${fmtRange(l.periodStart, l.periodEnd)}`}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            {l.recordId && (
              <Link
                to={`${REVIEWER_ROUTES.SUBMISSIONS}?record=${l.recordId}`}
                className="inline-icon"
              >
                View full submission in queue <ExternalLink size={13} aria-hidden="true" />
              </Link>
            )}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <p className="row-actions" style={{ marginBottom: 'var(--space-4)' }}>
        <StatusBadge
          status={l.factorScope === 'ORG_OVERRIDE' ? 'PENDING_APPROVAL' : 'APPROVED'}
          label={l.factorScope === 'ORG_OVERRIDE' ? 'Organization override factor' : 'Global default factor'}
        />
        {l.recalculatedCount > 0 && (
          <span className="badge badge--neutral">
            Recalculated {l.recalculatedCount}×
          </span>
        )}
      </p>

      <DetailList
        items={[
          ['Department', l.departmentName],
          ['Resource', l.resourceTypeName],
          ['Activity quantity', `${fmtNumber(l.quantity, 4)} ${l.unit}`],
          ['Total emissions', fmtCo2e(l.co2eKg)],
          ['Reporting period', fmtRange(l.periodStart, l.periodEnd)],
          ['Factor scope', l.factorScope === 'ORG_OVERRIDE' ? 'Organization override factor' : 'Global default factor'],
        ]}
      />

      <h3 className="section-title inline-icon" style={{ marginTop: 'var(--space-5)' }}>
        <GitFork size={16} aria-hidden="true" /> Emission factor breakdown
      </h3>

      {l.factors?.length > 0 ? (
        <div className="lineage">
          <p style={{ margin: '0 0 var(--space-2)' }}>
            <strong>How this was derived</strong> ({l.factorScope === 'ORG_OVERRIDE' ? 'organization override factor' : 'global default factor'}):
          </p>
          {l.factors.map((f) => (
            <p key={f.id} style={{ margin: '4px 0' }}>
              <code>
                {fmtNumber(l.quantity, 4)} {l.unit} × {f.factorValue} {f.unit} × GWP {f.gwp} ({f.gas})
              </code>{' '}
              ={' '}
              <strong style={{ color: 'var(--color-primary)' }}>
                {fmtCo2e(f.contributionKg)}
              </strong>
              <br />
              <span className="text-muted">
                Source: {f.sourceName} · effective {fmtDate(f.effectiveFrom)}
              </span>
            </p>
          ))}
        </div>
      ) : (
        <p className="text-muted">No factor breakdown recorded for this entry.</p>
      )}
    </Drawer>
  );
}

function Methodology() {
  const { data: types = [] } = useResourceTypes();
  const { data: sources = [] } = useFactorSources();
  const [typeId, setTypeId] = useState('');
  const [formTypeId, setFormTypeId] = useState('');
  const [factorOffset, setFactorOffset] = useState(0);
  const { data: versions = [], isLoading } = useFactorVersions(typeId);
  const create = useCreateFactorOverride();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useZodForm(overrideFactorSchema, { sourceId: '', gas: 'CO2', factorValue: '', gwp: '1', unit: '', effectiveFrom: isoToday(), notes: '' });

  const sourceName = (id) => sources.find((s) => s.id === id)?.name ?? '—';
  const resourceName = (id) => types.find((t) => t.id === id)?.name ?? '—';

  const onSubmit = async (v) => {
    const effectiveTypeId = typeId || formTypeId;
    if (!effectiveTypeId) {
      return showToast('Please select a resource type for the override.', 'error');
    }
    const typeName = types.find((t) => t.id === effectiveTypeId)?.name ?? 'this resource type';
    const ok = await confirm({
      title: `Add an override factor for ${typeName}?`,
      message: 'It takes precedence over the global factor for periods on or after its effective date, and locks once a calculation uses it.',
      confirmLabel: 'Create override',
      icon: FlaskConical,
    });
    if (!ok) return;
    try {
      await create.mutateAsync({ resourceTypeId: effectiveTypeId, sourceId: v.sourceId, gas: v.gas.trim(), factorValue: Number(v.factorValue), gwp: Number(v.gwp), unit: v.unit.trim(), effectiveFrom: v.effectiveFrom, notes: v.notes.trim() });
      showToast('Override factor created.', 'success');
      reset();
      setShowForm(false);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
    }
  };

  return (
    <Card>
      <CardHeader
        icon={FlaskConical}
        title="Emission factors"
        subtitle="Global defaults are maintained by the platform. You can add an organization-specific override that takes precedence for periods on or after its effective date."
        actions={!showForm ? (
          <Button icon={Plus} onClick={() => { setFormTypeId(typeId || (types[0]?.id ?? '')); setShowForm(true); }}>
            Add override factor
          </Button>
        ) : null}
      />

      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 'var(--space-4)' }}>
        <div style={{ minWidth: 260, maxWidth: 360, flex: 1 }}>
          <FormField label="Filter by resource type">
            <Select value={typeId} onChange={(e) => { setTypeId(e.target.value); setFormTypeId(e.target.value); setFactorOffset(0); }}>
              <option value="">All resource types ({types.length})</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </FormField>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ marginBottom: 'var(--space-5)', padding: 'var(--space-4)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 className="section-title" style={{ margin: 0 }}>New organization override factor</h3>
            <Button variant="ghost" size="sm" icon={X} onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
          <div className="callout" style={{ margin: '0 0 var(--space-4)' }}>
            Factors already used in a calculation are locked and never edited. A new factor applies to entries calculated after it — recalculate approved entries from Submissions to apply it to existing data.
          </div>
          <div className="split-2">
            {!typeId && (
              <FormField label="Target resource type" required>
                <Select value={formTypeId} onChange={(e) => setFormTypeId(e.target.value)}>
                  <option value="">Select a resource type…</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </FormField>
            )}
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
            <TextArea rows={2} maxLength={500} placeholder="e.g. Supplier-specific grid mix, certificate no. 2026-114 from GreenGrid Ltd." error={errors.notes} {...register('notes')} />
          </FormField>
          <div className="row-actions">
            <Button type="submit" icon={Plus} loading={create.isPending}>Create override</Button>
            <Button variant="ghost" icon={X} onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Scope</th>
              <th>Gas</th>
              <th className="num">Factor</th>
              <th className="num">GWP</th>
              <th>Source</th>
              <th>Effective from</th>
              <th>State</th>
              <th>Why / reference</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-muted">Loading emission factors…</td></tr>
            ) : versions.length === 0 ? (
              <tr><td colSpan={9} className="text-muted">No factors defined {typeId ? 'for this resource type' : 'yet'}.</td></tr>
            ) : (
              versions.slice(factorOffset, factorOffset + FACTOR_PAGE).map((f) => (
                <tr key={f.id}>
                  <td><strong>{resourceName(f.resourceTypeId)}</strong></td>
                  <td>
                    <span className={`badge badge--${f.organizationId ? 'primary' : 'neutral'}`}>
                      {f.organizationId ? 'Your override' : 'Global default'}
                    </span>
                  </td>
                  <td>{f.gas}</td>
                  <td className="num">{f.factorValue} <span className="text-muted">{f.unit}</span></td>
                  <td className="num">{f.gwp}</td>
                  <td>{sourceName(f.sourceId)}</td>
                  <td>{fmtDate(f.effectiveFrom)}</td>
                  <td>{f.isLocked ? 'In use (locked)' : 'Unused'}</td>
                  <td className="text-muted" style={{ maxWidth: 260 }}>{f.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {versions.length > FACTOR_PAGE && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--color-border)' }}>
          <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
            Showing {factorOffset + 1}–{Math.min(factorOffset + FACTOR_PAGE, versions.length)} of {versions.length}
          </span>
          <div className="row-actions">
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              disabled={factorOffset === 0}
              onClick={() => setFactorOffset(Math.max(0, factorOffset - FACTOR_PAGE))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={factorOffset + FACTOR_PAGE >= versions.length}
              onClick={() => setFactorOffset(factorOffset + FACTOR_PAGE)}
            >
              Next <ChevronRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
