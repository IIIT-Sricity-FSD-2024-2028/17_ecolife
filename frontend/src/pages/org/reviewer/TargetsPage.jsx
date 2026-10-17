import { useMemo, useState } from 'react';
import { useZodForm } from '../../../hooks/useZodForm';
import { targetSchema } from '../../../schemas/formSchemas';
import { Target, Plus, FilterX, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, AlertOctagon, Clock, Pencil, Trash2 } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ProgressBar } from '../../../components/ui/charts';
import { FormField, TextInput, TextArea, Select } from '../../../components/ui/FormField';
import { EmptyState } from '../../../components/shared/EmptyState';
import { Drawer } from '../../../components/ui/Drawer';
import { DetailList } from '../../../components/shared/DetailList';
import { useTargets, useCreateTarget, useUpdateTarget, useDeleteTarget, useDepartments } from '../../../hooks/useOrgData';
import { useEmissions } from '../../../hooks/useRoleData';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtCo2e, fmtMoney, fmtNumber, fmtRange, isoToday } from '../../../utils/format';
import { PageHeader } from '../../../components/ui/PageHeader';

const PAGE_SIZE = 10;
const CATEGORIES = ['FUEL', 'ELECTRICITY', 'WATER', 'WASTE', 'TRAVEL', 'OTHER'];
const METRIC_LABEL = { usage: 'Usage', cost: 'Cost', emissions: 'Emissions (kg CO₂e)' };

const formatValue = (metric, val) => {
  if (val == null) return '—';
  if (metric === 'emissions') return fmtCo2e(val);
  if (metric === 'cost') return fmtMoney(val);
  return `${fmtNumber(val, 2)} units`;
};

const getStatus = (t, pct) => {
  if (pct != null && pct > 100) return { key: 'exceeded', label: 'Exceeded', tone: 'danger', icon: AlertOctagon };
  if (pct != null && pct > 85) return { key: 'warning', label: 'Near limit', tone: 'warning', icon: AlertTriangle };
  if (t.periodEnd && t.periodEnd < isoToday()) return { key: 'expired', label: 'Completed', tone: 'neutral', icon: Clock };
  if (pct != null) return { key: 'ok', label: 'On track', tone: 'success', icon: CheckCircle2 };
  return { key: 'nodata', label: 'No data yet', tone: 'neutral', icon: Clock };
};

export function TargetsPage() {
  const { data: targets = [], isLoading } = useTargets();
  const { data: departments = [] } = useDepartments();
  const { data: emissions } = useEmissions({});
  const create = useCreateTarget();
  const update = useUpdateTarget();
  const deleteTarget = useDeleteTarget();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState({ search: '', departmentId: '', category: '', metric: '', status: '' });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useZodForm(targetSchema, {
    name: '',
    notes: '',
    departmentId: '',
    resourceCategory: '',
    metric: '',
    targetValue: '',
    periodStart: isoToday(),
    periodEnd: '',
  });

  const progress = useMemo(() => {
    const map = {};
    emissions?.departments.forEach((d) => d.targets.forEach((t) => { map[t.id] = t; }));
    emissions?.orgTargets.forEach((t) => { map[t.id] = t; });
    return map;
  }, [emissions]);

  const deptName = (id) => departments.find((d) => d.id === id)?.name ?? 'Org-wide';

  const filtered = useMemo(() => {
    return targets.filter((t) => {
      if (filters.search && !`${t.name || ''} ${t.notes || ''}`.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.departmentId && (filters.departmentId === 'ORG_WIDE' ? t.departmentId !== null : t.departmentId !== filters.departmentId)) return false;
      if (filters.category && t.resourceCategory !== filters.category) return false;
      if (filters.metric && t.metric !== filters.metric) return false;
      if (filters.status && getStatus(t, progress[t.id]?.percentOfTarget).key !== filters.status) return false;
      return true;
    });
  }, [targets, filters, progress]);

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + PAGE_SIZE);

  const setFilter = (key) => (e) => {
    setFilters((prev) => ({ ...prev, [key]: e.target.value }));
    setOffset(0);
  };

  const clearFilters = () => {
    setFilters({ search: '', departmentId: '', category: '', metric: '', status: '' });
    setOffset(0);
  };

  const onSubmit = async (v) => {
    const scope = v.departmentId ? deptName(v.departmentId) : 'the whole organization';
    const ok = await confirm({
      title: 'Create this target?',
      message: `A ${METRIC_LABEL[v.metric] ?? v.metric} target of ${v.targetValue} for ${scope}, ${fmtRange(v.periodStart, v.periodEnd)}.`,
      confirmLabel: 'Create target',
      icon: Target,
    });
    if (!ok) return;
    try {
      await create.mutateAsync({
        name: v.name?.trim() || undefined,
        notes: v.notes?.trim() || undefined,
        departmentId: v.departmentId || undefined,
        resourceCategory: v.resourceCategory || undefined,
        metric: v.metric,
        targetValue: Number(v.targetValue),
        periodStart: v.periodStart,
        periodEnd: v.periodEnd,
      });
      showToast('Target created.', 'success');
      reset();
      setShowForm(false);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
    }
  };

  const handleDelete = async (target) => {
    const ok = await confirm({
      title: 'Delete this target?',
      message: `Are you sure you want to delete "${target.name || 'this target'}"? Progress calculations against it will be removed.`,
      confirmLabel: 'Delete target',
      tone: 'danger',
      icon: Trash2,
    });
    if (!ok) return;
    try {
      await deleteTarget.mutateAsync(target.id);
      showToast('Target deleted.', 'success');
      setSelectedTarget(null);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to delete target.', 'error');
    }
  };

  return (
    <div className="stack">
      <PageHeader
        subtitle="Per department and resource category. Progress is measured on approved entries only."
        actions={<Button icon={Plus} onClick={() => setShowForm(true)}>New target</Button>}
      />

      <Card padded={false}>
        {/* Filters */}
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)' }}>
          <div className="filters" style={{ marginBottom: 0 }}>
            <FormField label="Search">
              <TextInput placeholder="Target name or notes" value={filters.search} onChange={setFilter('search')} />
            </FormField>
            <FormField label="Scope / Department">
              <Select value={filters.departmentId} onChange={setFilter('departmentId')}>
                <option value="">All scopes</option>
                <option value="ORG_WIDE">Org-wide only</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Category">
              <Select value={filters.category} onChange={setFilter('category')}>
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </FormField>
            <FormField label="Metric">
              <Select value={filters.metric} onChange={setFilter('metric')}>
                <option value="">All metrics</option>
                {Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </FormField>
            <FormField label="Health Status">
              <Select value={filters.status} onChange={setFilter('status')}>
                <option value="">All statuses</option>
                <option value="ok">On track</option>
                <option value="warning">Near limit</option>
                <option value="exceeded">Exceeded</option>
                <option value="expired">Completed</option>
              </Select>
            </FormField>
            {Object.values(filters).some(Boolean) && (
              <Button variant="ghost" size="sm" icon={FilterX} onClick={clearFilters}>Clear</Button>
            )}
          </div>
        </div>

        {!isLoading && targets.length === 0 && (
          <EmptyState icon={Target} title="No targets set yet" description="Create a target to start tracking department performance." />
        )}
        {!isLoading && targets.length > 0 && filtered.length === 0 && (
          <EmptyState icon={Target} title="No targets match these filters" description="Try clearing or adjusting your search criteria." />
        )}

        {filtered.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Department</th>
                  <th>Category</th>
                  <th>Metric</th>
                  <th>Actual / Target</th>
                  <th>Status</th>
                  <th>Period</th>
                  <th style={{ minWidth: 140 }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((t) => {
                  const p = progress[t.id];
                  const st = getStatus(t, p?.percentOfTarget);
                  return (
                    <tr key={t.id} className="clickable-row" onClick={() => setSelectedTarget(t)}>
                      <td style={{ maxWidth: 260 }}>
                        {t.name ? <strong>{t.name}</strong> : <span className="text-muted">Unnamed</span>}
                        {t.notes && (
                          <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                            {t.notes}
                          </div>
                        )}
                      </td>
                      <td>{t.departmentId ? deptName(t.departmentId) : <span className="badge badge--neutral">Org-wide</span>}</td>
                      <td>{t.resourceCategory ? <span className="badge badge--neutral">{t.resourceCategory}</span> : <span className="text-muted">All</span>}</td>
                      <td>{METRIC_LABEL[t.metric] ?? t.metric}</td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{formatValue(t.metric, p?.actual ?? 0)}</div>
                        <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>of {formatValue(t.metric, t.targetValue)}</div>
                      </td>
                      <td>
                        <span className={`badge badge--${st.tone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <st.icon size={12} /> {st.label}
                        </span>
                      </td>
                      <td>{fmtRange(t.periodStart, t.periodEnd)}</td>
                      <td>{p ? <ProgressBar percent={p.percentOfTarget} /> : <span className="text-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--color-border)' }}>
            <span className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
            <div className="row-actions">
              <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
                Next <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* New Target Modal */}
      {showForm && (
        <Drawer
          variant="modal"
          open
          width={540}
          title="New sustainability target"
          subtitle="Set a usage, cost, or emissions target for a department or the whole organization."
          onClose={() => { reset(); setShowForm(false); }}
        >
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FormField label="Name" error={errors.name} hint="Optional short label for recogniseability.">
              <TextInput maxLength={100} placeholder="Name this target" error={errors.name} {...register('name')} />
            </FormField>
            <div className="split-2">
              <FormField label="Department">
                <Select {...register('departmentId')}>
                  <option value="">Org-wide</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Resource category">
                <Select {...register('resourceCategory')}>
                  <option value="">All categories</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FormField>
              <FormField label="Metric" error={errors.metric} required>
                <Select error={errors.metric} {...register('metric')}>
                  <option value="">Select…</option>
                  {Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </FormField>
              <FormField label="Target value" error={errors.targetValue} required>
                <TextInput type="number" inputMode="decimal" step="any" min="0" placeholder="e.g. 5000" error={errors.targetValue} {...register('targetValue')} />
              </FormField>
              <FormField label="Period start" error={errors.periodStart} required>
                <TextInput type="date" error={errors.periodStart} {...register('periodStart')} />
              </FormField>
              <FormField label="Period end" error={errors.periodEnd} required>
                <TextInput type="date" error={errors.periodEnd} {...register('periodEnd')} />
              </FormField>
            </div>
            <FormField label="Notes" error={errors.notes} hint="Optional. Why this target, and how it was set.">
              <TextArea rows={2} maxLength={500} error={errors.notes} {...register('notes')} />
            </FormField>
            <div className="row-actions" style={{ marginTop: 'var(--space-4)' }}>
              <Button type="submit" icon={Plus} loading={isSubmitting}>Create target</Button>
              <Button variant="ghost" onClick={() => { reset(); setShowForm(false); }}>Cancel</Button>
            </div>
          </form>
        </Drawer>
      )}

      {/* Edit Target Modal */}
      {editingTarget && (
        <EditTargetDrawer
          target={editingTarget}
          departments={departments}
          onClose={() => setEditingTarget(null)}
          onSuccess={(updated) => {
            setEditingTarget(null);
            setSelectedTarget(updated);
            showToast('Target updated.', 'success');
          }}
        />
      )}

      {/* Target Details Drawer */}
      {selectedTarget && (
        <TargetDrawer
          target={selectedTarget}
          progress={progress[selectedTarget.id]}
          deptName={deptName(selectedTarget.departmentId)}
          onClose={() => setSelectedTarget(null)}
          onEdit={(t) => {
            setEditingTarget(t);
          }}
          onDelete={() => handleDelete(selectedTarget)}
        />
      )}
    </div>
  );
}

function EditTargetDrawer({ target, departments, onClose, onSuccess }) {
  const update = useUpdateTarget();
  const [name, setName] = useState(target.name || '');
  const [notes, setNotes] = useState(target.notes || '');
  const [departmentId, setDepartmentId] = useState(target.departmentId || '');
  const [resourceCategory, setResourceCategory] = useState(target.resourceCategory || '');
  const [metric, setMetric] = useState(target.metric || 'usage');
  const [targetValue, setTargetValue] = useState(target.targetValue || '');
  const [periodStart, setPeriodStart] = useState(target.periodStart || '');
  const [periodEnd, setPeriodEnd] = useState(target.periodEnd || '');
  const [error, setError] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    if (!targetValue || Number(targetValue) <= 0) {
      setError('Target value must be greater than 0');
      return;
    }
    if (!periodStart || !periodEnd) {
      setError('Period start and end dates are required');
      return;
    }
    if (new Date(periodEnd) < new Date(periodStart)) {
      setError('Period end date cannot be before start date');
      return;
    }

    try {
      const res = await update.mutateAsync({
        id: target.id,
        payload: {
          name: name.trim() || null,
          notes: notes.trim() || null,
          departmentId: departmentId || null,
          resourceCategory: resourceCategory || null,
          metric,
          targetValue: Number(targetValue),
          periodStart,
          periodEnd,
        },
      });
      onSuccess(res.data || { ...target, name, notes, departmentId: departmentId || null, resourceCategory: resourceCategory || null, metric, targetValue: Number(targetValue), periodStart, periodEnd });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update target.');
    }
  };

  return (
    <Drawer
      variant="modal"
      open
      width={540}
      title="Edit sustainability target"
      subtitle={`Update parameters for "${target.name || 'Target'}"`}
      onClose={onClose}
    >
      <form onSubmit={handleSave} noValidate>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <FormField label="Name">
          <TextInput maxLength={100} placeholder="Name this target" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <div className="split-2">
          <FormField label="Department">
            <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">Org-wide</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Resource category">
            <Select value={resourceCategory} onChange={(e) => setResourceCategory(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FormField>
          <FormField label="Metric" required>
            <Select value={metric} onChange={(e) => setMetric(e.target.value)}>
              {Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </FormField>
          <FormField label="Target value" required>
            <TextInput type="number" inputMode="decimal" step="any" min="0" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
          </FormField>
          <FormField label="Period start" required>
            <TextInput type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </FormField>
          <FormField label="Period end" required>
            <TextInput type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Notes">
          <TextArea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <div className="row-actions" style={{ marginTop: 'var(--space-4)' }}>
          <Button type="submit" icon={Pencil} loading={update.isPending}>Save changes</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Drawer>
  );
}

function TargetDrawer({ target, progress, deptName, onClose, onEdit, onDelete }) {
  const actual = progress?.actual ?? 0;
  const targetVal = target.targetValue;
  const variance = actual - targetVal;
  const variancePct = targetVal > 0 ? (variance / targetVal) * 100 : 0;
  const status = getStatus(target, progress?.percentOfTarget);

  return (
    <Drawer
      open
      title={target.name || 'Target Details'}
      subtitle={`${deptName} · ${METRIC_LABEL[target.metric] ?? target.metric}`}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Button variant="danger" size="sm" icon={Trash2} onClick={onDelete}>
            Delete
          </Button>
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => { onClose(); onEdit(target); }}>
            Edit target
          </Button>
        </div>
      }
    >
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <span className={`badge badge--${status.tone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-sm)', padding: '4px 10px' }}>
          <status.icon size={14} /> {status.label}
        </span>
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <h3 className="section-title">Current Performance</h3>
        {progress ? (
          <div style={{ marginTop: 8 }}>
            <ProgressBar percent={progress.percentOfTarget} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 'var(--font-size-xs)' }}>
              <span className="text-muted">Actual: <strong>{formatValue(target.metric, actual)}</strong></span>
              <span className="text-muted">Target: <strong>{formatValue(target.metric, targetVal)}</strong></span>
            </div>
          </div>
        ) : (
          <p className="text-muted">No approved data has been recorded in this scope/period yet.</p>
        )}
      </div>

      <h3 className="section-title">Specifications</h3>
      <DetailList
        items={[
          ['Scope', deptName],
          ['Resource category', target.resourceCategory || 'All categories'],
          ['Metric', METRIC_LABEL[target.metric] ?? target.metric],
          ['Target value', formatValue(target.metric, targetVal)],
          ['Actual approved', formatValue(target.metric, actual)],
          [
            'Variance vs target',
            progress
              ? `${variance >= 0 ? '+' : ''}${formatValue(target.metric, variance)} (${variancePct >= 0 ? '+' : ''}${variancePct.toFixed(1)}%)`
              : '—',
          ],
          ['Period', fmtRange(target.periodStart, target.periodEnd)],
        ]}
      />

      {target.notes && (
        <>
          <h3 className="section-title">Baseline & Policy Notes</h3>
          <p style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text)', lineHeight: 1.5 }}>
            {target.notes}
          </p>
        </>
      )}
    </Drawer>
  );
}
