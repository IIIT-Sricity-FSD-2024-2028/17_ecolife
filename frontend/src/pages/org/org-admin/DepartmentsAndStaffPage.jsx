import { Fragment, useState } from 'react';
import { useZodForm } from '../../../hooks/useZodForm';
import { departmentSchema, inviteUserSchema, editUserSchema } from '../../../schemas/formSchemas';
import { PasswordRules } from '../../../components/ui/PasswordRules';
import { Building, Plus, Pencil, Trash2, UserPlus, UserX, UserCheck, Eye, EyeOff, Save, X, ArrowRightLeft, Contact, ChevronLeft, ChevronRight, FilterX, SearchX, Layers, ShieldCheck } from 'lucide-react';
import { useDepartments, useCreateDepartment, useOrgUsers, useInviteOrgUser } from '../../../hooks/useOrgData';
import { useResourceTypes } from '../../../hooks/useResourceRecords';
import { useOrgAdminActions } from '../../../hooks/useRoleData';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardHeader } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Tabs';
import { Drawer } from '../../../components/ui/Drawer';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { FormField, TextInput, Select, PasswordInput } from '../../../components/ui/FormField';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { EmptyState } from '../../../components/shared/EmptyState';
import { rowProps } from '../../../components/shared/rowProps';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { ORG_ROLE_LABELS } from '../../../constants/roles';
import { fmtDate } from '../../../utils/format';

const PAGE_SIZE = 10;

export function DepartmentsAndStaffPage() {
  const [tab, setTab] = useState('departments');
  const { data: departments = [] } = useDepartments();
  const { data: users = [] } = useOrgUsers();
  return (
    <div>
      <PageHeader subtitle="Departments, who belongs to them, and every account in your organization." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'departments', label: 'Departments', icon: Building, count: departments.length }, { value: 'staff', label: 'All staff', icon: Contact, count: users.length }]} />
      {tab === 'departments' ? <Departments departments={departments} users={users} /> : <Staff departments={departments} users={users} />}
    </div>
  );
}

function OperationalBoundaryPicker({ resourceTypes = [], selectedIds = [], onChange, label = 'Operational Boundary (GHG Protocol Scope Custody)' }) {
  const [filter, setFilter] = useState('');
  const categories = Array.from(new Set(resourceTypes.map((r) => r.category).filter(Boolean)));

  const q = filter.trim().toLowerCase();
  const filtered = resourceTypes.filter((rt) => {
    if (!q) return true;
    return (
      rt.name?.toLowerCase().includes(q) ||
      rt.category?.toLowerCase().includes(q) ||
      rt.unit?.toLowerCase().includes(q)
    );
  });

  const isAllSelected = resourceTypes.length > 0 && selectedIds.length === resourceTypes.length;
  const isNoneSelected = selectedIds.length === 0;

  const handleSelectAll = () => onChange(resourceTypes.map((r) => r.id));
  const handleClearAll = () => onChange([]);

  const toggleCategory = (cat) => {
    const catTypeIds = resourceTypes.filter((r) => r.category === cat).map((r) => r.id);
    const allCatSelected = catTypeIds.length > 0 && catTypeIds.every((id) => selectedIds.includes(id));
    if (allCatSelected) {
      onChange(selectedIds.filter((id) => !catTypeIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedIds, ...catTypeIds]));
      onChange(merged);
    }
  };

  return (
    <div style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={16} style={{ color: 'var(--success-color, #10b981)' }} />
          {label}
        </label>
        <span style={{ fontSize: 'var(--font-size-xs)', color: isNoneSelected ? 'var(--text-muted)' : 'var(--primary-color)', fontWeight: 500 }}>
          {isNoneSelected ? 'All Streams Permitted (Unrestricted)' : `${selectedIds.length} of ${resourceTypes.length} Selected`}
        </span>
      </div>
      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-2) 0' }}>
        Leave empty to allow all enterprise streams. Check specific streams to restrict contributors in this department.
      </p>

      {/* Quick Search & Batch Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search streams..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            fontSize: 'var(--font-size-xs)',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            flex: '1 1 140px',
            minWidth: 120,
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            style={{ fontSize: '11px', padding: '2px 8px', height: 26 }}
            onClick={handleSelectAll}
            disabled={isAllSelected}
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            style={{ fontSize: '11px', padding: '2px 8px', height: 26 }}
            onClick={handleClearAll}
            disabled={isNoneSelected}
          >
            Clear (Allow all)
          </Button>
        </div>
      </div>

      {/* Category Quick Badges */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: 2 }}>Categories:</span>
          {categories.map((cat) => {
            const catTypeIds = resourceTypes.filter((r) => r.category === cat).map((r) => r.id);
            const allCatSelected = catTypeIds.length > 0 && catTypeIds.every((id) => selectedIds.includes(id));
            const someCatSelected = catTypeIds.some((id) => selectedIds.includes(id));
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  border: allCatSelected ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                  background: allCatSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-secondary)',
                  color: allCatSelected ? 'var(--primary-color)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: allCatSelected ? 600 : 400,
                }}
              >
                {allCatSelected ? '✓ ' : someCatSelected ? '• ' : '+ '}
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid of stream checkboxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, maxHeight: 180, overflowY: 'auto', padding: 10, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        {filtered.length === 0 ? (
          <p style={{ gridColumn: '1 / -1', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0' }}>
            No streams match &quot;{filter}&quot;
          </p>
        ) : (
          filtered.map((rt) => {
            const checked = selectedIds.includes(rt.id);
            return (
              <label key={rt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: checked ? 'var(--bg-primary)' : 'transparent', border: checked ? '1px solid var(--primary-color)' : '1px solid transparent' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...selectedIds, rt.id]);
                    else onChange(selectedIds.filter((id) => id !== rt.id));
                  }}
                />
                <span style={{ fontWeight: checked ? 600 : 400 }}>{rt.name}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{rt.category || rt.unit}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function Departments({ departments, users }) {
  const create = useCreateDepartment();
  const { updateDepartment, deleteDepartment } = useOrgAdminActions();
  const { data: resourceTypes = [] } = useResourceTypes();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [inviteFor, setInviteFor] = useState(null);
  const [createAllowedTypes, setCreateAllowedTypes] = useState([]);
  const [editAllowedTypes, setEditAllowedTypes] = useState([]);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useZodForm(departmentSchema, { name: '', description: '' });
  const edit = useZodForm(departmentSchema, { name: '', description: '' });
  const fail = (err) => showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');

  const q = search.trim().toLowerCase();
  const filtered = departments.filter((d) => {
    if (q && !d.name?.toLowerCase().includes(q) && !d.description?.toLowerCase().includes(q)) return false;
    return true;
  });
  const total = filtered.length;
  const paged = filtered.slice(offset, offset + PAGE_SIZE);

  const onCreate = async (v) => {
    const ok = await confirm({ title: `Create department “${v.name.trim()}”?`, message: 'It counts toward your plan’s department limit.', confirmLabel: 'Create department', icon: Plus });
    if (!ok) return;
    try {
      await create.mutateAsync({
        name: v.name,
        description: v.description || undefined,
        allowedResourceTypeIds: createAllowedTypes.length > 0 ? createAllowedTypes : undefined,
      });
      showToast('Department created.', 'success');
      reset();
      setCreateAllowedTypes([]);
      setShowForm(false);
    } catch (e) {
      fail(e);
    }
  };
  const onEdit = async (v) => {
    const ok = await confirm({ title: `Save changes to ${editing.name}?`, message: 'The department operational boundary, name, and description will be updated for everyone in your organization.', confirmLabel: 'Save changes', icon: Save });
    if (!ok) return;
    try {
      await updateDepartment.mutateAsync({
        id: editing.id,
        payload: {
          name: v.name.trim(),
          description: v.description?.trim() ?? '',
          allowedResourceTypeIds: editAllowedTypes,
        },
      });
      showToast('Department updated.', 'success');
      setEditing(null);
    } catch (e) {
      fail(e);
    }
  };
  const onDelete = async () => {
    try { await deleteDepartment.mutateAsync(deleting.id); showToast('Department deleted.', 'success'); } catch (e) { fail(e); } finally { setDeleting(null); }
  };

  return (
    <Card padded={false}>
      <div style={{ padding: 'var(--space-5)' }}>
        <CardHeader icon={Building} title="Departments" subtitle="Contributors belong to exactly one department; their emissions entries and scope custody are bounded by it." actions={<Button icon={showForm ? X : Plus} variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'New department'}</Button>} />
        {showForm && (
          <form onSubmit={handleSubmit(onCreate)} noValidate style={{ marginBottom: 'var(--space-4)' }}>
            <div className="split-2">
              <FormField label="Name" error={errors.name} required><TextInput placeholder="e.g. Fleet & Logistics" error={errors.name} {...register('name')} /></FormField>
              <FormField label="Description"><TextInput placeholder="What does this department do?" {...register('description')} /></FormField>
            </div>

            <OperationalBoundaryPicker
              resourceTypes={resourceTypes}
              selectedIds={createAllowedTypes}
              onChange={setCreateAllowedTypes}
            />

            <Button type="submit" icon={Plus} loading={isSubmitting}>Create department</Button>
          </form>
        )}
        <div className="filters" style={{ marginBottom: 0 }}>
          <FormField label="Search">
            <TextInput
              placeholder="Department name or description"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
            />
          </FormField>
          {search && (
            <Button
              variant="ghost"
              size="sm"
              icon={FilterX}
              onClick={() => {
                setSearch('');
                setOffset(0);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {departments.length === 0 ? (
        <EmptyState icon={Building} title="No departments yet" />
      ) : total === 0 ? (
        <EmptyState icon={SearchX} title="No matching departments" description="Try adjusting your search query." />
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Department</th><th>Description</th><th>Operational Boundary</th><th className="num">Active staff</th><th></th></tr></thead>
              <tbody>
                {paged.map((d) => {
                  const staff = users.filter((u) => u.departmentId === d.id && u.isActive);
                  const open = openId === d.id;
                  return (
                    <Fragment key={d.id}>
                      <tr>
                        <td><strong>{d.name}</strong></td>
                        <td className="text-muted">{d.description || '—'}</td>
                        <td>
                          {d.allowedResourceTypeIds && d.allowedResourceTypeIds.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {d.allowedResourceTypeIds.map((rid) => {
                                const rt = resourceTypes.find((t) => t.id === rid);
                                return (
                                  <span key={rid} style={{ fontSize: '11px', padding: '1px 6px', borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                    {rt?.name || rid}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              All Streams (Unrestricted)
                            </span>
                          )}
                        </td>
                        <td className="num">{staff.length}</td>
                        <td>
                          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                            <Button variant="ghost-success" size="sm" icon={open ? EyeOff : Eye} onClick={() => setOpenId(open ? null : d.id)}>{open ? 'Hide staff' : 'View staff'}</Button>
                            <Button variant="ghost-info" size="sm" icon={Pencil} onClick={() => { setEditing(d); setEditAllowedTypes(d.allowedResourceTypeIds ? [...d.allowedResourceTypeIds] : []); edit.reset({ name: d.name, description: d.description ?? '' }); }}>Edit</Button>
                            <Button variant="ghost-danger" size="sm" icon={Trash2} onClick={() => setDeleting(d)}>Delete</Button>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={5}>
                            <div className="lineage">
                              {staff.length === 0 ? <p style={{ margin: 0 }}>No active staff assigned.</p> : staff.map((u) => (
                                <p key={u.id} style={{ margin: '2px 0' }}>{u.fullName} <span className="text-muted">· {u.email} · {ORG_ROLE_LABELS[u.role]}</span></p>
                              ))}
                              <div style={{ marginTop: 'var(--space-3)' }}><Button size="sm" variant="secondary" icon={UserPlus} onClick={() => setInviteFor(d)}>Add contributor</Button></div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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

      <Drawer variant="modal" open={!!editing} onClose={() => setEditing(null)} title="Edit department" width={520}>
        <form onSubmit={edit.handleSubmit(onEdit)} noValidate>
          <FormField label="Name" error={edit.formState.errors.name} required><TextInput placeholder="Department name" error={edit.formState.errors.name} {...edit.register('name')} /></FormField>
          <FormField label="Description"><TextInput placeholder="Description" {...edit.register('description')} /></FormField>

          <OperationalBoundaryPicker
            resourceTypes={resourceTypes}
            selectedIds={editAllowedTypes}
            onChange={setEditAllowedTypes}
            label="Operational Boundary (Permitted Resource Streams)"
          />

          <Button type="submit" icon={Save} loading={updateDepartment.isPending}>Save changes</Button>
        </form>
      </Drawer>

      <Drawer variant="modal" open={!!inviteFor} onClose={() => setInviteFor(null)} title={`Add contributor to ${inviteFor?.name ?? ''}`} width={460}>
        {inviteFor && <InviteForm departments={departments} fixedDepartmentId={inviteFor.id} onDone={() => setInviteFor(null)} />}
      </Drawer>

      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.name}?`} message="This can’t be undone. Departments that still have entries or staff may be refused by the server." confirmLabel="Delete" danger loading={deleteDepartment.isPending} onConfirm={onDelete} onCancel={() => setDeleting(null)} />
    </Card>
  );
}

function Staff({ departments, users }) {
  const { user: me } = useAuth();
  const { updateUser } = useOrgAdminActions();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [deactivating, setDeactivating] = useState(null);
  const fail = (err) => showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
  const deptName = (id) => departments.find((d) => d.id === id)?.name ?? '—';

  const q = search.trim().toLowerCase();
  const shown = users.filter((u) => {
    if (filter && u.role !== filter) return false;
    if (q && !u.fullName?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
    return true;
  });
  const total = shown.length;
  const paged = shown.slice(offset, offset + PAGE_SIZE);

  const setActive = async (u, isActive) => {
    try { await updateUser.mutateAsync({ id: u.id, payload: { isActive } }); showToast(isActive ? `${u.fullName} reactivated.` : `${u.fullName} deactivated.`, 'success'); } catch (e) { fail(e); } finally { setDeactivating(null); }
  };
  const reactivate = async (u) => {
    const ok = await confirm({ title: `Reactivate ${u.fullName}?`, message: 'They will be able to sign in again straight away.', confirmLabel: 'Reactivate', icon: UserCheck });
    if (ok) setActive(u, true);
  };
  const moveTo = async (u, departmentId) => {
    if (departmentId === u.departmentId) return;
    const target = departments.find((d) => d.id === departmentId)?.name ?? 'the selected department';
    const ok = await confirm({ title: `Move ${u.fullName} to ${target}?`, message: 'Their future entries will be scoped to the new department. Past entries stay where they are.', confirmLabel: 'Move', icon: ArrowRightLeft });
    if (!ok) return;
    try { await updateUser.mutateAsync({ id: u.id, payload: { departmentId } }); showToast('Department updated.', 'success'); } catch (e) { fail(e); }
  };

  return (
    <Card padded={false}>
      <div style={{ padding: 'var(--space-5)' }}>
        <CardHeader icon={Contact} title="Staff" subtitle="New accounts are active immediately with the temporary password you set; they can change it from their profile." actions={<Button icon={UserPlus} onClick={() => setShowInvite(true)}>Invite user</Button>} />
        <div className="filters" style={{ marginBottom: 0 }}>
          <FormField label="Search">
            <TextInput
              placeholder="Name or email"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
            />
          </FormField>
          <FormField label="Role">
            <Select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">All roles</option>
              {Object.entries(ORG_ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </FormField>
          {(search || filter) && (
            <Button
              variant="ghost"
              size="sm"
              icon={FilterX}
              onClick={() => {
                setSearch('');
                setFilter('');
                setOffset(0);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>
      {users.length === 0 ? (
        <EmptyState icon={Contact} title="No staff members yet" />
      ) : total === 0 ? (
        <EmptyState icon={SearchX} title="No matching staff" description="Try adjusting your search or role filter." />
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Last sign-in</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {paged.map((u) => (
                  <tr key={u.id} {...rowProps(() => setEditingUser(u))}>
                    <td>{u.fullName}{u.isOwner ? <span className="text-muted"> (Owner)</span> : ''}</td>
                    <td>{u.email}</td>
                    <td>{ORG_ROLE_LABELS[u.role]}</td>
                    <td>
                      {u.role === 'CONTRIBUTOR' ? (
                        <Select
                          aria-label={`Department for ${u.fullName}`}
                          value={u.departmentId ?? ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => moveTo(u, e.target.value)}
                          disabled={!u.isActive}
                        >
                          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </Select>
                      ) : <span className="text-muted">Organization-wide</span>}
                    </td>
                    <td>{fmtDate(u.lastLogin)}</td>
                    <td><StatusBadge status={u.isActive ? 'ACTIVE' : 'SUSPENDED'} label={u.isActive ? 'Active' : 'Inactive'} /></td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <Button variant="ghost-info" size="sm" icon={Pencil} onClick={(e) => { e.stopPropagation(); setEditingUser(u); }}>Edit</Button>
                        {u.id !== me.sub && (u.isActive
                          ? <Button variant="ghost-danger" size="sm" icon={UserX} onClick={(e) => { e.stopPropagation(); setDeactivating(u); }}>Deactivate</Button>
                          : <Button variant="ghost-success" size="sm" icon={UserCheck} onClick={(e) => { e.stopPropagation(); reactivate(u); }}>Reactivate</Button>)}
                      </div>
                    </td>
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

      <Drawer variant="modal" open={showInvite} onClose={() => setShowInvite(false)} title="Invite a team member" width={460}>
        <InviteForm departments={departments} onDone={() => setShowInvite(false)} />
      </Drawer>
      <Drawer variant="modal" open={!!editingUser} onClose={() => setEditingUser(null)} title={`Edit ${editingUser?.fullName ?? 'user'}`} width={460}>
        {editingUser && <EditUserForm user={editingUser} departments={departments} onDone={() => setEditingUser(null)} />}
      </Drawer>
      <ConfirmDialog open={!!deactivating} title={`Deactivate ${deactivating?.fullName}?`} message="They will no longer be able to sign in. Their history is preserved and you can reactivate them later." confirmLabel="Deactivate" danger loading={updateUser.isPending} onConfirm={() => setActive(deactivating, false)} onCancel={() => setDeactivating(null)} />
    </Card>
  );
}

function EditUserForm({ user, departments, onDone }) {
  const { updateUser } = useOrgAdminActions();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useZodForm(editUserSchema, {
    fullName: user.fullName ?? '',
    role: user.role ?? 'CONTRIBUTOR',
    departmentId: user.departmentId ?? '',
  });
  const role = watch('role');

  const onSubmit = async (v) => {
    setServerError(null);
    const ok = await confirm({
      title: `Save changes to ${user.fullName}?`,
      message: 'Their details and role permissions will be updated immediately.',
      confirmLabel: 'Save changes',
      icon: Save,
    });
    if (!ok) return;
    try {
      await updateUser.mutateAsync({
        id: user.id,
        payload: {
          fullName: v.fullName.trim(),
          ...(user.isOwner ? {} : { role: v.role }),
          departmentId: (!user.isOwner && v.role === 'CONTRIBUTOR') ? v.departmentId : undefined,
        },
      });
      showToast(`${v.fullName.trim()} updated.`, 'success');
      onDone();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormField label="Full Name" error={errors.fullName} required>
        <TextInput placeholder="Their full name" error={errors.fullName} {...register('fullName')} />
      </FormField>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label className="field-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Email Address</label>
        <TextInput value={user.email} disabled />
        <span className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Email cannot be changed directly.</span>
      </div>
      {user.isOwner ? (
        <>
          <input type="hidden" {...register('role')} value="ORG_ADMIN" />
          <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>
            Role: <strong>{ORG_ROLE_LABELS.ORG_ADMIN} (Owner)</strong>
            <span style={{ display: 'block', fontSize: 'var(--font-size-xs)' }}>The organization owner must remain an Org Admin.</span>
          </p>
        </>
      ) : (
        <>
          <FormField label="Role" error={errors.role} required>
            <Select error={errors.role} {...register('role')}>
              {Object.entries(ORG_ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </FormField>
          {role === 'CONTRIBUTOR' && (
            <FormField label="Department" error={errors.departmentId} required>
              <Select error={errors.departmentId} {...register('departmentId')}>
                <option value="">Select a department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </FormField>
          )}
        </>
      )}
      {serverError && <p className="auth-error" role="alert">{serverError}</p>}
      <Button type="submit" icon={Save} loading={isSubmitting}>Save changes</Button>
    </form>
  );
}

function InviteForm({ departments, fixedDepartmentId, onDone }) {
  const invite = useInviteOrgUser();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useZodForm(inviteUserSchema, { fullName: '', email: '', role: fixedDepartmentId ? 'CONTRIBUTOR' : '', departmentId: fixedDepartmentId ?? '', temporaryPassword: '' });
  const role = watch('role');
  const tempPassword = watch('temporaryPassword');
  const fixedDepartment = departments.find((d) => d.id === fixedDepartmentId);

  const onSubmit = async (v) => {
    setServerError(null);
    const ok = await confirm({ title: `Add ${v.fullName.trim()} to your team?`, message: `They will get a ${ORG_ROLE_LABELS[v.role] ?? 'team member'} account that is active immediately.`, confirmLabel: 'Add team member', icon: UserPlus });
    if (!ok) return;
    try {
      await invite.mutateAsync({ email: v.email.trim(), fullName: v.fullName.trim(), role: v.role, departmentId: v.role === 'CONTRIBUTOR' ? v.departmentId : undefined, temporaryPassword: v.temporaryPassword });
      showToast(`${v.fullName.trim()} added.`, 'success');
      onDone();
    } catch (err) { setServerError(err instanceof ApiError ? err.message : 'Something went wrong.'); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormField label="Full Name" error={errors.fullName} required><TextInput placeholder="Their full name" error={errors.fullName} {...register('fullName')} /></FormField>
      <FormField label="Email Address" error={errors.email} required><TextInput type="email" placeholder="name@company.com" error={errors.email} {...register('email')} /></FormField>
      {fixedDepartmentId ? (
        // Role and department are fixed here, so they are shown as text rather than as disabled inputs
        // (disabled inputs are dropped from the submitted values).
        <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>
          Role: <strong>{ORG_ROLE_LABELS.CONTRIBUTOR}</strong> · Department: <strong>{fixedDepartment?.name ?? '—'}</strong>
        </p>
      ) : (
        <>
          <FormField label="Role" error={errors.role} required>
            <Select error={errors.role} {...register('role')}>
              <option value="">Select a role…</option>
              {Object.entries(ORG_ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </FormField>
          {role === 'CONTRIBUTOR' && (
            <FormField label="Department" error={errors.departmentId} required>
              <Select error={errors.departmentId} {...register('departmentId')}>
                <option value="">Select a department…</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </FormField>
          )}
        </>
      )}
      <FormField label="Temporary Password" error={errors.temporaryPassword} required hint="Share this securely. They can change it after signing in.">
        <PasswordInput autoComplete="new-password" placeholder="Set a temporary password" error={errors.temporaryPassword} {...register('temporaryPassword')} />
      </FormField>
      <PasswordRules value={tempPassword} />
      {serverError && <p className="auth-error" role="alert">{serverError}</p>}
      <Button type="submit" icon={UserPlus} loading={isSubmitting}>Add team member</Button>
    </form>
  );
}
