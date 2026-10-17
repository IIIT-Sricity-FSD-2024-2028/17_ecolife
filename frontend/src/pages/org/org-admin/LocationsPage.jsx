import { useState } from 'react';
import { useZodForm } from '../../../hooks/useZodForm';
import { locationSchema } from '../../../schemas/formSchemas';
import { MapPin, Plus, Pencil, Trash2, Save, ChevronLeft, ChevronRight, FilterX, SearchX } from 'lucide-react';
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
import { rowProps } from '../../../components/shared/rowProps';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';

const PAGE_SIZE = 10;

export function LocationsPage() {
  const { data: departments = [] } = useDepartments();
  const [deptId, setDeptId] = useState('');
  const [search, setSearch] = useState('');
  const { data: locations = [], isLoading } = useLocations(deptId || undefined);
  const { createLocation, updateLocation, deleteLocation } = useOrgAdminActions();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState(null); // location | 'new'
  const [deleting, setDeleting] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useZodForm(locationSchema, { departmentId: '', name: '', address: '' });
  const fail = (err) => showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
  const deptName = (id) => departments.find((d) => d.id === id)?.name ?? '—';

  const q = search.trim().toLowerCase();
  const filtered = locations.filter((l) => {
    if (q && !l.name?.toLowerCase().includes(q) && !l.address?.toLowerCase().includes(q)) return false;
    return true;
  });
  const total = filtered.length;
  const paged = filtered.slice(offset, offset + PAGE_SIZE);

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
            <FormField label="Search">
              <TextInput
                placeholder="Location name or address"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOffset(0);
                }}
              />
            </FormField>
            <FormField label="Department">
              <Select
                value={deptId}
                onChange={(e) => {
                  setDeptId(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </FormField>
            {(search || deptId) && (
              <Button
                variant="ghost"
                size="sm"
                icon={FilterX}
                onClick={() => {
                  setSearch('');
                  setDeptId('');
                  setOffset(0);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        {isLoading && (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <p className="text-muted">Loading locations…</p>
          </div>
        )}
        {!isLoading && locations.length === 0 && (
          <EmptyState
            icon={MapPin}
            title={deptId ? 'No locations in this department' : 'No locations yet'}
            description={deptId ? 'Choose a different department or add a new site.' : 'Add a site to a department to start tagging entries by location.'}
          />
        )}
        {!isLoading && locations.length > 0 && total === 0 && (
          <EmptyState
            icon={SearchX}
            title="No matching locations"
            description="Try adjusting your search query or department filter."
          />
        )}
        {!isLoading && locations.length > 0 && (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Location</th><th>Department</th><th>Address</th><th></th></tr></thead>
                <tbody>
                  {paged.map((l) => (
                    <tr key={l.id} {...rowProps(() => open(l))}>
                      <td><strong>{l.name}</strong></td>
                      <td>{deptName(l.departmentId)}</td>
                      <td className="text-muted">{l.address || '—'}</td>
                      <td><div className="row-actions" style={{ justifyContent: 'flex-end' }}><Button variant="ghost" size="sm" icon={Pencil} onClick={(e) => { e.stopPropagation(); open(l); }}>Edit</Button><Button variant="ghost-danger" size="sm" icon={Trash2} onClick={(e) => { e.stopPropagation(); setDeleting(l); }}>Delete</Button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > PAGE_SIZE && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-5)', borderTop: '1px solid var(--border-color)', fontSize: 'var(--font-size-sm)' }}>
                <span className="text-muted">
                  Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ChevronLeft}
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={offset + PAGE_SIZE >= total}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                  >
                    Next
                    <ChevronRight size={14} style={{ marginLeft: 4 }} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Drawer variant="modal" open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add location' : 'Edit location'} width={440}>
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
