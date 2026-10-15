import { useState } from 'react';
import { useZodForm } from '../../../hooks/useZodForm';
import { locationSchema } from '../../../schemas/formSchemas';
import { MapPin, Plus, Pencil, Trash2, Save } from 'lucide-react';
import { useDepartments } from '../../../hooks/useOrgData';
import { useLocations } from '../../../hooks/useOrgData';
import { useOrgAdminActions } from '../../../hooks/useRoleData';
import { Card, CardHeader } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { FormField, TextInput, Select } from '../../../components/ui/FormField';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';

export function LocationsPage() {
  const { data: departments = [] } = useDepartments();
  const [deptId, setDeptId] = useState('');
  const { data: locations = [], isLoading } = useLocations(deptId || undefined);
  const { createLocation, updateLocation, deleteLocation } = useOrgAdminActions();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null); // location | 'new'
  const [deleting, setDeleting] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useZodForm(locationSchema, { departmentId: '', name: '', address: '' });
  const fail = (err) => showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
  const deptName = (id) => departments.find((d) => d.id === id)?.name ?? '—';

  const open = (loc) => {
    setEditing(loc);
    reset(loc === 'new' ? { departmentId: deptId, name: '', address: '' } : { departmentId: loc.departmentId, name: loc.name, address: loc.address ?? '' });
  };

  const onSubmit = async (v) => {
    const isNew = editing === 'new';
    const ok = await confirm({ title: isNew ? `Add location “${v.name.trim()}”?` : `Save changes to ${editing.name}?`, message: isNew ? `It will be added to ${deptName(v.departmentId)}.` : 'The name and address will be updated wherever this location appears.', confirmLabel: isNew ? 'Add location' : 'Save changes', icon: isNew ? Plus : Save });
    if (!ok) return;
    try {
      if (editing === 'new') await createLocation.mutateAsync({ departmentId: v.departmentId, name: v.name, address: v.address || undefined });
      else await updateLocation.mutateAsync({ id: editing.id, payload: { name: v.name, address: v.address ?? '' } });
      showToast(editing === 'new' ? 'Location added.' : 'Location updated.', 'success');
      setEditing(null);
    } catch (e) { fail(e); }
  };
  const onDelete = async () => {
    try { await deleteLocation.mutateAsync(deleting.id); showToast('Location deleted.', 'success'); } catch (e) { fail(e); } finally { setDeleting(null); }
  };

  return (
    <div>
      <PageHeader subtitle="Sites within each department. Contributors can tag usage entries to a location." />
      <Card padded={false}>
        <div style={{ padding: 'var(--space-5)' }}>
          <CardHeader icon={MapPin} title="All locations" actions={<Button icon={Plus} onClick={() => open('new')} disabled={departments.length === 0}>Add location</Button>} />
          <div className="filters" style={{ marginBottom: 0 }}>
            <FormField label="Department">
              <Select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </FormField>
          </div>
        </div>
        {!isLoading && locations.length === 0 && <EmptyState icon={MapPin} title="No locations yet" description="Add a site to a department to start tagging entries by location." />}
        {locations.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Location</th><th>Department</th><th>Address</th><th></th></tr></thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id}>
                    <td><strong>{l.name}</strong></td>
                    <td>{deptName(l.departmentId)}</td>
                    <td className="text-muted">{l.address || '—'}</td>
                    <td><div className="row-actions" style={{ justifyContent: 'flex-end' }}><Button variant="ghost" size="sm" icon={Pencil} onClick={() => open(l)}>Edit</Button><Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleting(l)}>Delete</Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add location' : 'Edit location'} width={440}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {editing === 'new' ? (
            <FormField label="Department" error={errors.departmentId} required>
              <Select error={errors.departmentId} {...register('departmentId')}>
                <option value="">Select a department…</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </FormField>
          ) : (
            // A location can't move between departments, so it's shown as text (a disabled input would be dropped from the form values).
            <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>Department: <strong>{deptName(editing?.departmentId)}</strong></p>
          )}
          <FormField label="Name" error={errors.name} required><TextInput placeholder="e.g. Plant A" error={errors.name} {...register('name')} /></FormField>
          <FormField label="Address"><TextInput placeholder="Street address" {...register('address')} /></FormField>
          <Button type="submit" icon={editing === 'new' ? Plus : Save} loading={isSubmitting}>{editing === 'new' ? 'Add location' : 'Save changes'}</Button>
        </form>
      </Drawer>
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.name}?`} message="Entries already tagged to this location keep their history." confirmLabel="Delete" danger loading={deleteLocation.isPending} onConfirm={onDelete} onCancel={() => setDeleting(null)} />
    </div>
  );
}
