import { useState } from 'react';
import { useZodForm } from '../../../hooks/useZodForm';
import { targetSchema } from '../../../schemas/formSchemas';
import { Target, Plus, X } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ProgressBar } from '../../../components/ui/charts';
import { FormField, TextInput, TextArea, Select } from '../../../components/ui/FormField';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useTargets, useCreateTarget, useDepartments } from '../../../hooks/useOrgData';
import { useEmissions } from '../../../hooks/useRoleData';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtNumber, fmtRange } from '../../../utils/format';
import { PageHeader } from '../../../components/ui/PageHeader';

const CATEGORIES = ['FUEL', 'ELECTRICITY', 'WATER', 'WASTE', 'TRAVEL', 'OTHER'];
const METRIC_LABEL = { usage: 'Usage', cost: 'Cost', emissions: 'Emissions (kg CO₂e)' };

export function TargetsPage() {
  const { data: targets = [], isLoading } = useTargets();
  const { data: departments = [] } = useDepartments();
  const { data: emissions } = useEmissions({});
  const create = useCreateTarget();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useZodForm(targetSchema, { name: '', notes: '', departmentId: '', resourceCategory: '', metric: '', targetValue: '', periodStart: '', periodEnd: '' });

  // Actuals come from approved data only; org-wide targets are measured across the whole organization.
  const progress = {};
  emissions?.departments.forEach((d) => d.targets.forEach((t) => { progress[t.id] = t; }));
  emissions?.orgTargets.forEach((t) => { progress[t.id] = t; });
  const deptName = (id) => departments.find((d) => d.id === id)?.name ?? 'Org-wide';

  const onSubmit = async (v) => {
    const scope = v.departmentId ? deptName(v.departmentId) : 'the whole organization';
    const ok = await confirm({ title: 'Create this target?', message: `A ${METRIC_LABEL[v.metric] ?? v.metric} target of ${v.targetValue} for ${scope}, ${fmtRange(v.periodStart, v.periodEnd)}. Targets can’t be edited afterwards.`, confirmLabel: 'Create target', icon: Target });
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

  return (
    <div className="stack">
      <PageHeader subtitle="Per department and resource category. Progress is measured on approved entries only." actions={<Button icon={showForm ? X : Plus} variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'New target'}</Button>} />
      <Card>

        {showForm && (
          <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ marginBottom: 'var(--space-5)' }}>
            <FormField label="Name" error={errors.name} hint="Optional. A short label so the target is easy to recognise, e.g. “Cut Plant A electricity 10%”.">
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
            <FormField label="Notes" error={errors.notes} hint="Optional. Why this target, and how it was set (baseline, policy, commitment).">
              <TextArea rows={2} maxLength={500} error={errors.notes} {...register('notes')} />
            </FormField>
            <Button type="submit" icon={Plus} loading={isSubmitting}>Create target</Button>
          </form>
        )}

        {!isLoading && targets.length === 0 && <EmptyState icon={Target} title="No targets set yet" description="Create a target to start tracking department performance." />}
        {targets.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Target</th><th>Department</th><th>Category</th><th>Metric</th><th className="num">Target</th><th>Period</th><th>Progress</th></tr></thead>
              <tbody>
                {targets.map((t) => (
                  <tr key={t.id}>
                    <td style={{ maxWidth: 300 }}>{t.name ? <strong>{t.name}</strong> : <span className="text-muted">Unnamed</span>}{t.notes && <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{t.notes}</div>}</td>
                    <td>{t.departmentId ? deptName(t.departmentId) : 'Org-wide'}</td>
                    <td>{t.resourceCategory ?? 'All'}</td>
                    <td>{METRIC_LABEL[t.metric] ?? t.metric}</td>
                    <td className="num">{fmtNumber(t.targetValue, 2)}</td>
                    <td>{fmtRange(t.periodStart, t.periodEnd)}</td>
                    <td>{progress[t.id] ? <ProgressBar percent={progress[t.id].percentOfTarget} /> : <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
