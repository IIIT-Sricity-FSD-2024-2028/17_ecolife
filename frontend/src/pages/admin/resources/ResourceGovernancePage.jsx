import { useState } from 'react';
import { Boxes, FlaskConical, BookMarked, Plus, ExternalLink } from 'lucide-react';
import { useZodForm } from '../../../hooks/useZodForm';
import { resourceTypeSchema, factorSchema, sourceSchema } from '../../../schemas/formSchemas';
import { useAdminResourceTypes, useAdminFactorSources, useAdminFactorVersions, useAdminMutations } from '../../../hooks/useAdminData';
import { Card, CardHeader } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { Drawer } from '../../../components/ui/Drawer';
import { FormField, TextInput, Select, TextArea } from '../../../components/ui/FormField';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtDate, fmtNumber, isoToday } from '../../../utils/format';

const CATEGORIES = ['FUEL', 'ELECTRICITY', 'WATER', 'WASTE', 'TRAVEL', 'OTHER'];
const fail = (showToast) => (err) => showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');

export function ResourceGovernancePage() {
  const [tab, setTab] = useState('types');
  return (
    <div>
      <PageHeader subtitle="The shared catalog every organization builds on: what can be measured, in which units, and the emission factors used to convert it." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'types', label: 'Resource types & units', icon: Boxes }, { value: 'factors', label: 'Emission factors', icon: FlaskConical }, { value: 'sources', label: 'Factor sources', icon: BookMarked }]} />
      {tab === 'types' && <Types />}
      {tab === 'factors' && <Factors />}
      {tab === 'sources' && <Sources />}
    </div>
  );
}

function Types() {
  const { data: types = [], isLoading } = useAdminResourceTypes();
  const { createResourceType } = useAdminMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useZodForm(resourceTypeSchema, { name: '', category: '', description: '', defaultUnit: '', units: '', evidenceThreshold: '' });

  const onSubmit = async (v) => {
    const ok = await confirm({ title: `Create resource type “${v.name.trim()}”?`, message: 'It becomes available to every organization on the platform.', confirmLabel: 'Create', icon: Plus });
    if (!ok) return;
    const units = [...new Set(v.units.split(',').map((u) => u.trim()).filter(Boolean))];
    const defaultUnit = v.defaultUnit.trim();
    if (!units.includes(defaultUnit)) units.unshift(defaultUnit);
    try {
      await createResourceType.mutateAsync({ name: v.name.trim(), category: v.category, description: v.description?.trim() || undefined, evidenceThreshold: v.evidenceThreshold, units, defaultUnit });
      showToast('Resource type created. Add a global emission factor so it can be calculated.', 'success');
      reset(); setOpen(false);
    } catch (e) { fail(showToast)(e); }
  };

  return (
    <Card padded={false}>
      <div style={{ padding: 'var(--space-5)' }}>
        <CardHeader icon={Boxes} title="Resource types" subtitle="Units are validated on entry, so electricity can never be logged in liters." actions={<Button icon={Plus} onClick={() => setOpen(true)}>New resource type</Button>} />
      </div>
      {!isLoading && types.length === 0 && <EmptyState icon={Boxes} title="No resource types" />}
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Category</th><th>Units</th><th className="num">Evidence above</th><th className="num">Global factors</th><th className="num">Org overrides</th></tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td>
                <td>{t.category}</td>
                <td>{t.units.map((u) => (u.isDefault ? `${u.unit} (default)` : u.unit)).join(', ')}</td>
                <td className="num">{t.evidenceThreshold == null ? '—' : fmtNumber(t.evidenceThreshold, 0)}</td>
                <td className="num" style={t.globalFactorCount === 0 ? { color: 'var(--color-danger)' } : undefined}>{t.globalFactorCount}</td>
                <td className="num">{t.overrideCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="New resource type" width={460}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Name" error={errors.name} required><TextInput placeholder="e.g. Propane" error={errors.name} {...register('name')} /></FormField>
          <FormField label="Category" error={errors.category} required>
            <Select error={errors.category} {...register('category')}>
              <option value="">Select a category…</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FormField>
          <FormField label="Description"><TextArea rows={2} placeholder="Optional" {...register('description')} /></FormField>
          <FormField label="Default unit" error={errors.defaultUnit} required><TextInput placeholder="e.g. kg" error={errors.defaultUnit} {...register('defaultUnit')} /></FormField>
          <FormField label="All allowed units" error={errors.units} required hint="Comma-separated. The default unit is added automatically."><TextInput placeholder="kg, tonnes" error={errors.units} {...register('units')} /></FormField>
          <FormField label="Evidence required above" hint="Quantities above this need supporting evidence. Leave empty for none."><TextInput type="number" inputMode="decimal" step="any" min="0" placeholder="e.g. 500" {...register('evidenceThreshold')} /></FormField>
          <Button type="submit" icon={Plus} loading={isSubmitting}>Create resource type</Button>
        </form>
      </Drawer>
    </Card>
  );
}

function Factors() {
  const { data: types = [] } = useAdminResourceTypes();
  const { data: sources = [] } = useAdminFactorSources();
  const { createGlobalFactor } = useAdminMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [typeId, setTypeId] = useState('');
  const { data: versions = [] } = useAdminFactorVersions(typeId);
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useZodForm(factorSchema, { sourceId: '', gas: 'CO2', factorValue: '', gwp: '1', unit: '', effectiveFrom: isoToday(), notes: '' });
  const type = types.find((t) => t.id === typeId);

  const onSubmit = async (v) => {
    const ok = await confirm({
      title: `Add a global factor for ${type?.name ?? 'this resource type'}?`,
      message: 'It will be used for every organization without its own override, and locks once a calculation uses it.',
      confirmLabel: 'Add factor',
      icon: FlaskConical,
    });
    if (!ok) return;
    try {
      await createGlobalFactor.mutateAsync({ resourceTypeId: typeId, sourceId: v.sourceId, gas: v.gas.trim(), factorValue: Number(v.factorValue), gwp: Number(v.gwp), unit: v.unit.trim(), effectiveFrom: v.effectiveFrom, notes: (v.notes ?? '').trim() });
      showToast('Global factor added.', 'success'); reset(); setOpen(false);
    } catch (e) { fail(showToast)(e); }
  };

  return (
    <Card>
      <CardHeader icon={FlaskConical} title="Emission factors" subtitle="A factor already used in a calculation is locked — publish a new version instead of editing it. Organization overrides take precedence over the global default." />
      <FormField label="Resource type">
        <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">Select a resource type…</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </FormField>
      {typeId && (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Scope</th><th>Gas</th><th className="num">Factor</th><th className="num">GWP</th><th>Source</th><th>Effective from</th><th>State</th><th>Why / reference</th></tr></thead>
              <tbody>
                {versions.length === 0 && <tr><td colSpan={8} className="text-muted">No factors yet — emissions can’t be calculated for this type.</td></tr>}
                {versions.map((f) => (
                  <tr key={f.id}>
                    <td>{f.organizationName ? `Override · ${f.organizationName}` : 'Global'}</td>
                    <td>{f.gas}</td><td className="num">{f.factorValue} <span className="text-muted">{f.unit}</span></td><td className="num">{f.gwp}</td>
                    <td>{f.sourceName}</td><td>{fmtDate(f.effectiveFrom)}</td><td>{f.isLocked ? 'In use (locked)' : 'Unused'}</td>
                    <td className="text-muted" style={{ maxWidth: 280 }}>{f.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 'var(--space-4)' }}><Button variant="secondary" icon={Plus} onClick={() => setOpen(true)} disabled={sources.length === 0}>Add global factor</Button>{sources.length === 0 && <span className="text-muted"> Add a factor source first.</span>}</div>
        </>
      )}

      <Drawer open={open} onClose={() => setOpen(false)} title={`New global factor${type ? ` · ${type.name}` : ''}`} width={460}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Source" error={errors.sourceId} required>
            <Select error={errors.sourceId} {...register('sourceId')}><option value="">Select a source…</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          </FormField>
          <FormField label="Gas" error={errors.gas} required><TextInput placeholder="CO2" error={errors.gas} {...register('gas')} /></FormField>
          <FormField label="Factor value" error={errors.factorValue} required><TextInput type="number" inputMode="decimal" step="any" min="0" placeholder="2.68" error={errors.factorValue} {...register('factorValue')} /></FormField>
          <FormField label="GWP" error={errors.gwp} required><TextInput type="number" inputMode="decimal" step="any" min="0" placeholder="1" error={errors.gwp} {...register('gwp')} /></FormField>
          <FormField label="Factor unit" error={errors.unit} required hint="The activity unit this factor applies to, e.g. liters."><TextInput placeholder="liters" error={errors.unit} {...register('unit')} /></FormField>
          <FormField label="Effective from" error={errors.effectiveFrom} required><TextInput type="date" error={errors.effectiveFrom} {...register('effectiveFrom')} /></FormField>
          <FormField label="Notes" error={errors.notes} hint="Optional. Table, page or method this value comes from, and any assumptions."><TextArea rows={3} maxLength={500} error={errors.notes} {...register('notes')} /></FormField>
          <Button type="submit" icon={Plus} loading={isSubmitting}>Add factor</Button>
        </form>
      </Drawer>
    </Card>
  );
}

function Sources() {
  const { data: sources = [] } = useAdminFactorSources();
  const { createSource } = useAdminMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useZodForm(sourceSchema, { name: '', publisher: '', referenceUrl: '' });

  const onSubmit = async (v) => {
    const ok = await confirm({ title: `Add source “${v.name.trim()}”?`, message: 'Factor sources are kept for traceability in every calculation.', confirmLabel: 'Add source', icon: BookMarked });
    if (!ok) return;
    try { await createSource.mutateAsync({ name: v.name.trim(), publisher: v.publisher.trim(), referenceUrl: v.referenceUrl?.trim() || undefined }); showToast('Source added.', 'success'); reset(); setOpen(false); }
    catch (e) { fail(showToast)(e); }
  };

  return (
    <Card padded={false}>
      <div style={{ padding: 'var(--space-5)' }}><CardHeader icon={BookMarked} title="Factor sources" subtitle="Where factor values come from, kept for traceability in every calculation." actions={<Button icon={Plus} onClick={() => setOpen(true)}>Add source</Button>} /></div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Publisher</th><th>Reference</th><th>Added</th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}><td><strong>{s.name}</strong></td><td>{s.publisher}</td><td>{s.referenceUrl ? <a href={s.referenceUrl} target="_blank" rel="noreferrer" className="inline-icon">Open <ExternalLink size={13} aria-hidden="true" /></a> : '—'}</td><td>{fmtDate(s.createdAt)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Add factor source" width={440}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Name" error={errors.name} required><TextInput placeholder="e.g. DEFRA 2026 Conversion Factors" error={errors.name} {...register('name')} /></FormField>
          <FormField label="Publisher" error={errors.publisher} required><TextInput placeholder="e.g. UK Government" error={errors.publisher} {...register('publisher')} /></FormField>
          <FormField label="Reference URL"><TextInput type="url" placeholder="https://…" {...register('referenceUrl')} /></FormField>
          <Button type="submit" icon={Plus} loading={isSubmitting}>Add source</Button>
        </form>
      </Drawer>
    </Card>
  );
}
