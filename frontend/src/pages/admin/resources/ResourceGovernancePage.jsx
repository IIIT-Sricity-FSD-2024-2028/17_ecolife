import { useState } from 'react';
import {
  Boxes,
  FlaskConical,
  BookMarked,
  Plus,
  ExternalLink,
  Lock,
  Info,
  RotateCcw,
  Archive,
  Trash2,
  Pencil,
} from 'lucide-react';
import { useZodForm } from '../../../hooks/useZodForm';
import { resourceTypeSchema, factorSchema, sourceSchema } from '../../../schemas/formSchemas';
import {
  useAdminResourceTypes,
  useAdminFactorSources,
  useAdminFactorVersions,
  useAdminMutations,
} from '../../../hooks/useAdminData';
import { Card, CardHeader } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { Drawer } from '../../../components/ui/Drawer';
import { FormField, TextInput, Select, TextArea } from '../../../components/ui/FormField';
import { Checkbox } from '../../../components/ui/Checkbox';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtDate, fmtNumber, isoToday } from '../../../utils/format';

const CATEGORIES = ['FUEL', 'ELECTRICITY', 'WATER', 'WASTE', 'TRAVEL', 'OTHER'];
const fail = (showToast) => (err) =>
  showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');

export function ResourceGovernancePage() {
  const [tab, setTab] = useState('types');
  return (
    <div>
      <PageHeader subtitle="The shared catalog every organization builds on: what can be measured, in which units, and the emission factors used to convert it." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'types', label: 'Resource types & units', icon: Boxes },
          { value: 'factors', label: 'Emission factors', icon: FlaskConical },
          { value: 'sources', label: 'Factor sources', icon: BookMarked },
        ]}
      />
      {tab === 'types' && <Types />}
      {tab === 'factors' && <Factors />}
      {tab === 'sources' && <Sources />}
    </div>
  );
}

// ============================================================================
// 1. Resource Types & Units
// ============================================================================
function Types() {
  const { data: types = [], isLoading } = useAdminResourceTypes();
  const { createResourceType, updateResourceType, deleteResourceType } = useAdminMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useZodForm(resourceTypeSchema, {
    name: '',
    category: '',
    description: '',
    defaultUnit: '',
    units: '',
    evidenceThreshold: '',
  });

  const onCreateSubmit = async (v) => {
    const ok = await confirm({
      title: `Create resource type “${v.name.trim()}”?`,
      message: 'It becomes available to every organization on the platform.',
      confirmLabel: 'Create',
      icon: Plus,
    });
    if (!ok) return;

    const units = [...new Set(v.units.split(',').map((u) => u.trim()).filter(Boolean))];
    const defaultUnit = v.defaultUnit.trim();
    if (!units.includes(defaultUnit)) units.unshift(defaultUnit);

    try {
      await createResourceType.mutateAsync({
        name: v.name.trim(),
        category: v.category,
        description: v.description?.trim() || undefined,
        evidenceThreshold: v.evidenceThreshold,
        units,
        defaultUnit,
      });
      showToast('Resource type created. Add a global emission factor so it can be calculated.', 'success');
      reset();
      setCreateOpen(false);
    } catch (e) {
      fail(showToast)(e);
    }
  };

  const handleRetireOrDelete = async (t) => {
    const isRetired = t.isActive === false;
    const hasDependencies = (t.recordCount ?? 0) > 0 || (t.globalFactorCount ?? 0) > 0 || (t.overrideCount ?? 0) > 0;

    if (isRetired) {
      // Allow reactivating
      const ok = await confirm({
        title: `Reactivate resource type “${t.name}”?`,
        message: 'It will be restored to active status and made available to organizations for activity data entry.',
        confirmLabel: 'Reactivate',
        icon: RotateCcw,
      });
      if (!ok) return;

      try {
        await updateResourceType.mutateAsync({ id: t.id, payload: { isActive: true } });
        showToast(`Resource type “${t.name}” reactivated.`, 'success');
      } catch (e) {
        fail(showToast)(e);
      }
      return;
    }

    // Active resource type: check if it should be retired or deleted
    if (hasDependencies) {
      const ok = await confirm({
        title: `Retire resource type “${t.name}”?`,
        message: `This resource type has ${t.recordCount ?? 0} usage record(s) and ${(t.globalFactorCount ?? 0) + (t.overrideCount ?? 0)} emission factor(s). Retiring it will deactivate it from organization data entry forms while strictly preserving all historical calculations and audit trails.`,
        confirmLabel: 'Retire',
        icon: Archive,
      });
      if (!ok) return;

      try {
        const res = await deleteResourceType.mutateAsync(t.id);
        showToast(res?.message || `Resource type “${t.name}” retired.`, 'success');
      } catch (e) {
        fail(showToast)(e);
      }
    } else {
      const ok = await confirm({
        title: `Permanently delete “${t.name}”?`,
        message: 'This resource type has no linked usage records or emission factors and will be permanently removed.',
        confirmLabel: 'Delete permanently',
        icon: Trash2,
      });
      if (!ok) return;

      try {
        const res = await deleteResourceType.mutateAsync(t.id);
        showToast(res?.message || `Resource type “${t.name}” deleted.`, 'success');
      } catch (e) {
        fail(showToast)(e);
      }
    }
  };

  return (
    <Card padded={false}>
      <div style={{ padding: 'var(--space-5)' }}>
        <CardHeader
          icon={Boxes}
          title="Resource types & compatible units"
          subtitle="Units are validated on entry, so electricity can never be logged in liters. Inactive/retired types preserve historical records."
          actions={
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>
              New resource type
            </Button>
          }
        />
      </div>

      {!isLoading && types.length === 0 && <EmptyState icon={Boxes} title="No resource types configured" />}

      {types.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name & Status</th>
                <th>Category</th>
                <th>Units</th>
                <th className="num">Evidence above</th>
                <th className="num">Usage records</th>
                <th className="num">Global factors</th>
                <th className="num">Org overrides</th>
                <th style={{ width: 110, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => {
                const isRetired = t.isActive === false;
                const hasDeps = (t.recordCount ?? 0) > 0 || (t.globalFactorCount ?? 0) > 0 || (t.overrideCount ?? 0) > 0;
                return (
                  <tr key={t.id} style={isRetired ? { opacity: 0.75 } : undefined}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <strong>{t.name}</strong>
                        {isRetired ? (
                          <StatusBadge status="SUPERSEDED" label="Retired" />
                        ) : (
                          <StatusBadge status="ACTIVE" label="Active" />
                        )}
                      </div>
                      {t.description && (
                        <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)', maxWidth: 280 }}>
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td>{t.category}</td>
                    <td>
                      {t.units.map((u) => (u.isDefault ? `${u.unit} (default)` : u.unit)).join(', ')}
                    </td>
                    <td className="num">
                      {t.evidenceThreshold == null ? '—' : fmtNumber(t.evidenceThreshold, 0)}
                    </td>
                    <td className="num">{t.recordCount ?? 0}</td>
                    <td
                      className="num"
                      style={t.globalFactorCount === 0 ? { color: 'var(--color-danger)', fontWeight: 600 } : undefined}
                    >
                      {t.globalFactorCount}
                    </td>
                    <td className="num">{t.overrideCount}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions" style={{ justifyContent: 'flex-end', display: 'flex', gap: 'var(--space-1)' }}>
                        <Button
                          variant="ghost-info"
                          size="sm"
                          onClick={() => setEditingType(t)}
                        >
                          Edit
                        </Button>
                        {isRetired ? (
                          <Button
                            variant="ghost-success"
                            size="sm"
                            onClick={() => handleRetireOrDelete(t)}
                          >
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            variant="ghost-danger"
                            size="sm"
                            onClick={() => handleRetireOrDelete(t)}
                          >
                            {hasDeps ? 'Retire' : 'Delete'}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer: Create Resource Type */}
      <Drawer variant="modal" open={createOpen} onClose={() => setCreateOpen(false)} title="New resource type" width={480}>
        <form onSubmit={handleSubmit(onCreateSubmit)} noValidate>
          <FormField label="Name" error={errors.name} required>
            <TextInput placeholder="e.g. Propane" error={errors.name} {...register('name')} />
          </FormField>
          <FormField label="Category" error={errors.category} required>
            <Select error={errors.category} {...register('category')}>
              <option value="">Select a category…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Description">
            <TextArea rows={2} placeholder="Optional notes about this resource type" {...register('description')} />
          </FormField>
          <FormField label="Default unit" error={errors.defaultUnit} required hint="Primary unit used in dashboards and defaults.">
            <TextInput placeholder="e.g. kg" error={errors.defaultUnit} {...register('defaultUnit')} />
          </FormField>
          <FormField
            label="All allowed units"
            error={errors.units}
            required
            hint="Comma-separated list. Default unit is added automatically."
          >
            <TextInput placeholder="kg, tonnes, lbs" error={errors.units} {...register('units')} />
          </FormField>
          <FormField
            label="Evidence required above"
            hint="Entries above this quantity will prompt for supporting bills/evidence. Leave empty for none."
          >
            <TextInput
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="e.g. 500"
              {...register('evidenceThreshold')}
            />
          </FormField>
          <Button type="submit" icon={Plus} loading={isSubmitting}>
            Create resource type
          </Button>
        </form>
      </Drawer>

      {/* Drawer: Edit Resource Type */}
      {editingType && (
        <EditResourceTypeDrawer
          key={editingType.id}
          type={editingType}
          open={!!editingType}
          onClose={() => setEditingType(null)}
          onSave={async (payload) => {
            await updateResourceType.mutateAsync({ id: editingType.id, payload });
            showToast(`Resource type “${payload.name || editingType.name}” updated.`, 'success');
            setEditingType(null);
          }}
        />
      )}
    </Card>
  );
}

function EditResourceTypeDrawer({ type, open, onClose, onSave }) {
  const { showToast } = useToast();
  const [name, setName] = useState(type.name || '');
  const [category, setCategory] = useState(type.category || 'OTHER');
  const [description, setDescription] = useState(type.description || '');
  const [defaultUnit, setDefaultUnit] = useState(
    type.units?.find((u) => u.isDefault)?.unit || type.units?.[0]?.unit || '',
  );
  const [units, setUnits] = useState(type.units?.map((u) => u.unit).join(', ') || '');
  const [evidenceThreshold, setEvidenceThreshold] = useState(
    type.evidenceThreshold == null ? '' : String(type.evidenceThreshold),
  );
  const [isActive, setIsActive] = useState(type.isActive !== false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name is required.', 'error');
      return;
    }
    if (!defaultUnit.trim()) {
      showToast('Default unit is required.', 'error');
      return;
    }
    const unitList = [...new Set(units.split(',').map((u) => u.trim()).filter(Boolean))];
    if (!unitList.includes(defaultUnit.trim())) {
      unitList.unshift(defaultUnit.trim());
    }

    const cleanThreshold = evidenceThreshold.trim();
    const thresholdNum = cleanThreshold === '' ? null : Number(cleanThreshold);
    if (thresholdNum !== null && (Number.isNaN(thresholdNum) || thresholdNum < 0)) {
      showToast('Evidence threshold must be a valid positive number or left blank.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        category,
        description: description.trim() || null,
        defaultUnit: defaultUnit.trim(),
        units: unitList,
        evidenceThreshold: thresholdNum,
        isActive,
      });
    } catch (err) {
      fail(showToast)(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer variant="modal" open={open} onClose={onClose} title={`Edit resource type · ${type.name}`} width={480}>
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Name" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Propane" />
        </FormField>
        <FormField label="Category" required>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Description">
          <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
        </FormField>
        <FormField label="Default unit" required hint="Primary unit used in summaries and dropdowns.">
          <TextInput value={defaultUnit} onChange={(e) => setDefaultUnit(e.target.value)} placeholder="e.g. kg" />
        </FormField>
        <FormField label="Allowed units" required hint="Comma-separated. Units currently used by existing usage records cannot be removed.">
          <TextInput value={units} onChange={(e) => setUnits(e.target.value)} placeholder="kg, tonnes, lbs" />
        </FormField>
        <FormField label="Evidence required above" hint="Usage above this requires supporting evidence. Empty for none.">
          <TextInput
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={evidenceThreshold}
            onChange={(e) => setEvidenceThreshold(e.target.value)}
            placeholder="e.g. 500"
          />
        </FormField>
        <div style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <Checkbox
            label="Active in catalog (visible to organizations for data entry)"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
        </div>
        <Button type="submit" icon={Pencil} loading={submitting}>
          Save changes
        </Button>
      </form>
    </Drawer>
  );
}

// ============================================================================
// 2. Emission Factors
// ============================================================================
function Factors() {
  const { data: types = [] } = useAdminResourceTypes();
  const { data: sources = [] } = useAdminFactorSources();
  const { createGlobalFactor, updateFactorVersion, deleteFactorVersion } = useAdminMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [typeId, setTypeId] = useState('');
  const { data: versions = [] } = useAdminFactorVersions(typeId);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingFactor, setEditingFactor] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useZodForm(factorSchema, {
    sourceId: '',
    gas: 'CO2',
    factorValue: '',
    gwp: '1',
    unit: '',
    effectiveFrom: isoToday(),
    notes: '',
  });

  const type = types.find((t) => t.id === typeId);

  const onCreateSubmit = async (v) => {
    const ok = await confirm({
      title: `Add a global factor for ${type?.name ?? 'this resource type'}?`,
      message: 'It will be used for every organization without its own override, and locks once a calculation uses it.',
      confirmLabel: 'Add factor',
      icon: FlaskConical,
    });
    if (!ok) return;

    try {
      await createGlobalFactor.mutateAsync({
        resourceTypeId: typeId,
        sourceId: v.sourceId,
        gas: v.gas.trim(),
        factorValue: Number(v.factorValue),
        gwp: Number(v.gwp),
        unit: v.unit.trim(),
        effectiveFrom: v.effectiveFrom,
        notes: (v.notes ?? '').trim(),
      });
      showToast('Global factor added.', 'success');
      reset();
      setCreateOpen(false);
    } catch (e) {
      fail(showToast)(e);
    }
  };

  const handleDeleteFactor = async (factor) => {
    if (factor.isLocked) {
      showToast('Cannot delete a locked factor version that has already converted data in emissions calculations.', 'error');
      return;
    }

    const ok = await confirm({
      title: `Delete emission factor (${factor.gas})?`,
      message: `Permanently delete this factor version (${factor.factorValue} ${factor.unit}) from ${factor.sourceName}?`,
      confirmLabel: 'Delete factor',
      icon: Trash2,
    });
    if (!ok) return;

    try {
      await deleteFactorVersion.mutateAsync(factor.id);
      showToast('Emission factor version deleted.', 'success');
    } catch (e) {
      fail(showToast)(e);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={FlaskConical}
        title="Emission factors catalog"
        subtitle="Factors used in calculations are permanently locked to preserve accounting provenance. Unlocked factors can be edited or deleted."
      />

      <FormField label="Resource type">
        <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">Select a resource type…</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.category})
            </option>
          ))}
        </Select>
      </FormField>

      {typeId && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              margin: 'var(--space-4) 0 var(--space-2)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
            }}
          >
            <Info size={16} aria-hidden="true" />
            <span>
              Showing factors for <strong>{type?.name}</strong>. Global factors apply to all organizations unless an organization-specific override is defined.
            </span>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Gas</th>
                  <th className="num">Factor</th>
                  <th className="num">GWP</th>
                  <th>Source</th>
                  <th>Effective from</th>
                  <th>State</th>
                  <th>Why / reference</th>
                  <th style={{ width: 90, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-muted">
                      No factors configured yet — emissions cannot be calculated for {type?.name}.
                    </td>
                  </tr>
                )}
                {versions.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {f.organizationName ? (
                        <span style={{ fontWeight: 500 }}>Override · {f.organizationName}</span>
                      ) : (
                        <span className="text-muted">Global default</span>
                      )}
                    </td>
                    <td>
                      <strong>{f.gas}</strong>
                    </td>
                    <td className="num">
                      {f.factorValue} <span className="text-muted">{f.unit}</span>
                    </td>
                    <td className="num">{f.gwp}</td>
                    <td>{f.sourceName}</td>
                    <td>{fmtDate(f.effectiveFrom)}</td>
                    <td>
                      {f.isLocked ? (
                        <StatusBadge status="LOCKED" label="Locked (in use)" />
                      ) : (
                        <StatusBadge status="DRAFT" label="Unused (editable)" />
                      )}
                    </td>
                    <td className="text-muted" style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.notes || ''}>
                      {f.notes || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions" style={{ justifyContent: 'flex-end', display: 'flex', gap: 'var(--space-1)' }}>
                        <Button
                          variant="ghost-info"
                          size="sm"
                          onClick={() => setEditingFactor(f)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost-danger"
                          size="sm"
                          disabled={f.isLocked}
                          onClick={() => handleDeleteFactor(f)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 'var(--space-4)' }}>
            <Button variant="secondary" icon={Plus} onClick={() => setCreateOpen(true)} disabled={sources.length === 0}>
              Add global factor
            </Button>
            {sources.length === 0 && <span className="text-muted"> Add a factor source first.</span>}
          </div>
        </>
      )}

      {/* Drawer: Add Global Factor */}
      <Drawer
        variant="modal"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={`New global factor${type ? ` · ${type.name}` : ''}`}
        width={480}
      >
        <form onSubmit={handleSubmit(onCreateSubmit)} noValidate>
          <FormField label="Source" error={errors.sourceId} required>
            <Select error={errors.sourceId} {...register('sourceId')}>
              <option value="">Select a source…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.publisher})
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Gas" error={errors.gas} required>
            <TextInput placeholder="CO2" error={errors.gas} {...register('gas')} />
          </FormField>
          <FormField label="Factor value" error={errors.factorValue} required>
            <TextInput
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="e.g. 2.68"
              error={errors.factorValue}
              {...register('factorValue')}
            />
          </FormField>
          <FormField label="GWP (Global Warming Potential)" error={errors.gwp} required>
            <TextInput
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="1"
              error={errors.gwp}
              {...register('gwp')}
            />
          </FormField>
          <FormField label="Factor unit" error={errors.unit} required hint="The activity unit this factor converts from, e.g. kWh or liters.">
            <TextInput placeholder="e.g. kWh" error={errors.unit} {...register('unit')} />
          </FormField>
          <FormField label="Effective from" error={errors.effectiveFrom} required>
            <TextInput type="date" error={errors.effectiveFrom} {...register('effectiveFrom')} />
          </FormField>
          <FormField label="Notes / Reference" error={errors.notes} hint="Optional. Table, methodology, or assumptions for auditors.">
            <TextArea rows={3} maxLength={500} error={errors.notes} {...register('notes')} />
          </FormField>
          <Button type="submit" icon={Plus} loading={isSubmitting}>
            Add factor
          </Button>
        </form>
      </Drawer>

      {/* Drawer: Edit Factor Version */}
      {editingFactor && (
        <EditFactorDrawer
          key={editingFactor.id}
          factor={editingFactor}
          sources={sources}
          open={!!editingFactor}
          onClose={() => setEditingFactor(null)}
          onSave={async (payload) => {
            await updateFactorVersion.mutateAsync({ id: editingFactor.id, payload });
            showToast('Emission factor version updated.', 'success');
            setEditingFactor(null);
          }}
        />
      )}
    </Card>
  );
}

function EditFactorDrawer({ factor, sources, open, onClose, onSave }) {
  const { showToast } = useToast();
  const [sourceId, setSourceId] = useState(factor.sourceId || '');
  const [gas, setGas] = useState(factor.gas || '');
  const [factorValue, setFactorValue] = useState(factor.factorValue == null ? '' : String(factor.factorValue));
  const [gwp, setGwp] = useState(factor.gwp == null ? '1' : String(factor.gwp));
  const [unit, setUnit] = useState(factor.unit || '');
  const [effectiveFrom, setEffectiveFrom] = useState(
    factor.effectiveFrom ? String(factor.effectiveFrom).slice(0, 10) : '',
  );
  const [notes, setNotes] = useState(factor.notes || '');
  const [submitting, setSubmitting] = useState(false);

  const isLocked = factor.isLocked;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isLocked) {
        // Locked: only notes are updated
        await onSave({ notes: notes.trim() || null });
      } else {
        // Unlocked: full update allowed
        if (!sourceId) {
          showToast('Source is required.', 'error');
          setSubmitting(false);
          return;
        }
        if (!gas.trim()) {
          showToast('Gas is required.', 'error');
          setSubmitting(false);
          return;
        }
        if (!factorValue.trim() || Number.isNaN(Number(factorValue)) || Number(factorValue) < 0) {
          showToast('Valid non-negative factor value is required.', 'error');
          setSubmitting(false);
          return;
        }
        if (!unit.trim()) {
          showToast('Unit is required.', 'error');
          setSubmitting(false);
          return;
        }
        if (!effectiveFrom) {
          showToast('Effective date is required.', 'error');
          setSubmitting(false);
          return;
        }
        await onSave({
          sourceId,
          gas: gas.trim(),
          factorValue: Number(factorValue),
          gwp: Number(gwp) || 1,
          unit: unit.trim(),
          effectiveFrom,
          notes: notes.trim() || null,
        });
      }
    } catch (err) {
      fail(showToast)(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer variant="modal" open={open} onClose={onClose} title={`Edit emission factor · ${factor.gas}`} width={480}>
      <form onSubmit={handleSubmit} noValidate>
        {isLocked && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--color-bg-secondary)',
              borderLeft: '4px solid var(--color-warning)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
              <Lock size={15} color="var(--color-warning)" aria-hidden="true" />
              <span>Conversion values are permanently locked</span>
            </div>
            This factor version is in active use in emissions calculations. Numerical parameters cannot be altered to guarantee carbon accounting provenance. You can update notes below, or publish a new version for future dates.
          </div>
        )}

        <FormField label="Source" required>
          <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)} disabled={isLocked}>
            <option value="">Select a source…</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.publisher})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Gas" required>
          <TextInput value={gas} onChange={(e) => setGas(e.target.value)} disabled={isLocked} placeholder="CO2" />
        </FormField>
        <FormField label="Factor value" required>
          <TextInput
            type="number"
            inputMode="decimal"
            step="any"
            value={factorValue}
            onChange={(e) => setFactorValue(e.target.value)}
            disabled={isLocked}
            placeholder="e.g. 2.68"
          />
        </FormField>
        <FormField label="GWP (Global Warming Potential)" required>
          <TextInput
            type="number"
            inputMode="decimal"
            step="any"
            value={gwp}
            onChange={(e) => setGwp(e.target.value)}
            disabled={isLocked}
            placeholder="1"
          />
        </FormField>
        <FormField label="Factor unit" required>
          <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} disabled={isLocked} placeholder="e.g. kWh" />
        </FormField>
        <FormField label="Effective from" required>
          <TextInput
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            disabled={isLocked}
          />
        </FormField>
        <FormField label="Notes / Reference" hint="Table, study, or justification for auditors.">
          <TextArea rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Audit notes" />
        </FormField>
        <Button type="submit" icon={Pencil} loading={submitting}>
          {isLocked ? 'Update notes' : 'Save changes'}
        </Button>
      </form>
    </Drawer>
  );
}

// ============================================================================
// 3. Factor Sources
// ============================================================================
function Sources() {
  const { data: sources = [], isLoading } = useAdminFactorSources();
  const { createSource, updateFactorSource, deleteFactorSource } = useAdminMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useZodForm(sourceSchema, { name: '', publisher: '', referenceUrl: '' });

  const onCreateSubmit = async (v) => {
    const ok = await confirm({
      title: `Add source “${v.name.trim()}”?`,
      message: 'Factor sources are kept for traceability in every calculation.',
      confirmLabel: 'Add source',
      icon: BookMarked,
    });
    if (!ok) return;

    try {
      await createSource.mutateAsync({
        name: v.name.trim(),
        publisher: v.publisher.trim(),
        referenceUrl: v.referenceUrl?.trim() || undefined,
      });
      showToast('Source added.', 'success');
      reset();
      setCreateOpen(false);
    } catch (e) {
      fail(showToast)(e);
    }
  };

  const handleDeleteSource = async (source) => {
    const linkedCount = source.factorCount ?? 0;
    if (linkedCount > 0) {
      showToast(
        `Cannot delete factor source “${source.name}” because it is referenced by ${linkedCount} emission factor version(s). Please delete or reassign those factors first.`,
        'error',
      );
      return;
    }

    const ok = await confirm({
      title: `Delete source “${source.name}”?`,
      message: 'This source has no linked emission factors and will be permanently removed.',
      confirmLabel: 'Delete source',
      icon: Trash2,
    });
    if (!ok) return;

    try {
      await deleteFactorSource.mutateAsync(source.id);
      showToast(`Factor source “${source.name}” deleted.`, 'success');
    } catch (e) {
      fail(showToast)(e);
    }
  };

  return (
    <Card padded={false}>
      <div style={{ padding: 'var(--space-5)' }}>
        <CardHeader
          icon={BookMarked}
          title="Emission factor sources"
          subtitle="Where factor values come from, kept for traceability in every calculation."
          actions={
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>
              Add source
            </Button>
          }
        />
      </div>

      {!isLoading && sources.length === 0 && <EmptyState icon={BookMarked} title="No factor sources configured" />}

      {sources.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Publisher</th>
                <th>Reference</th>
                <th className="num">Linked factors</th>
                <th>Added</th>
                <th style={{ width: 90, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const linkedCount = s.factorCount ?? 0;
                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                    </td>
                    <td>{s.publisher}</td>
                    <td>
                      {s.referenceUrl ? (
                        <a href={s.referenceUrl} target="_blank" rel="noreferrer" className="inline-icon">
                          Open <ExternalLink size={13} aria-hidden="true" />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num">
                      <span className={linkedCount > 0 ? undefined : 'text-muted'}>
                        {linkedCount} version{linkedCount === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td>{fmtDate(s.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions" style={{ justifyContent: 'flex-end', display: 'flex', gap: 'var(--space-1)' }}>
                        <Button
                          variant="ghost-info"
                          size="sm"
                          onClick={() => setEditingSource(s)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost-danger"
                          size="sm"
                          disabled={linkedCount > 0}
                          onClick={() => handleDeleteSource(s)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer: Add Source */}
      <Drawer variant="modal" open={createOpen} onClose={() => setCreateOpen(false)} title="Add factor source" width={460}>
        <form onSubmit={handleSubmit(onCreateSubmit)} noValidate>
          <FormField label="Name" error={errors.name} required>
            <TextInput placeholder="e.g. DEFRA 2026 Conversion Factors" error={errors.name} {...register('name')} />
          </FormField>
          <FormField label="Publisher" error={errors.publisher} required>
            <TextInput placeholder="e.g. UK Government" error={errors.publisher} {...register('publisher')} />
          </FormField>
          <FormField label="Reference URL">
            <TextInput type="url" placeholder="https://…" {...register('referenceUrl')} />
          </FormField>
          <Button type="submit" icon={Plus} loading={isSubmitting}>
            Add source
          </Button>
        </form>
      </Drawer>

      {/* Drawer: Edit Source */}
      {editingSource && (
        <EditSourceDrawer
          key={editingSource.id}
          source={editingSource}
          open={!!editingSource}
          onClose={() => setEditingSource(null)}
          onSave={async (payload) => {
            await updateFactorSource.mutateAsync({ id: editingSource.id, payload });
            showToast(`Source “${payload.name}” updated.`, 'success');
            setEditingSource(null);
          }}
        />
      )}
    </Card>
  );
}

function EditSourceDrawer({ source, open, onClose, onSave }) {
  const { showToast } = useToast();
  const [name, setName] = useState(source.name || '');
  const [publisher, setPublisher] = useState(source.publisher || '');
  const [referenceUrl, setReferenceUrl] = useState(source.referenceUrl || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name is required.', 'error');
      return;
    }
    if (!publisher.trim()) {
      showToast('Publisher is required.', 'error');
      return;
    }
    const cleanRef = referenceUrl.trim();
    if (cleanRef && !/^https?:\/\/\S+\.\S+/.test(cleanRef)) {
      showToast('Please enter a valid http(s) URL for reference (starting with http:// or https://).', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        publisher: publisher.trim(),
        referenceUrl: cleanRef || null,
      });
    } catch (err) {
      fail(showToast)(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer variant="modal" open={open} onClose={onClose} title={`Edit factor source · ${source.name}`} width={460}>
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Name" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DEFRA 2026 Conversion Factors" />
        </FormField>
        <FormField label="Publisher" required>
          <TextInput value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="e.g. UK Government" />
        </FormField>
        <FormField label="Reference URL">
          <TextInput type="url" value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)} placeholder="https://…" />
        </FormField>
        <Button type="submit" icon={Pencil} loading={submitting}>
          Save changes
        </Button>
      </form>
    </Drawer>
  );
}
