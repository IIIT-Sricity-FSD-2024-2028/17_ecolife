import { Fragment, useState } from 'react';
import { useZodForm } from '../../../hooks/useZodForm';
import { departmentSchema, inviteUserSchema } from '../../../schemas/formSchemas';
import { PasswordRules } from '../../../components/ui/PasswordRules';
import { Building, Plus, Pencil, Trash2, UserPlus, UserX, UserCheck, Eye, EyeOff, Save, X, ArrowRightLeft, Contact } from 'lucide-react';
import { useDepartments, useCreateDepartment, useOrgUsers, useInviteOrgUser } from '../../../hooks/useOrgData';
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
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { ORG_ROLE_LABELS } from '../../../constants/roles';
import { fmtDate } from '../../../utils/format';


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

function Departments({ departments, users }) {
  const create = useCreateDepartment();
  const { updateDepartment, deleteDepartment } = useOrgAdminActions();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [inviteFor, setInviteFor] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useZodForm(departmentSchema, { name: '', description: '' });
  const edit = useZodForm(departmentSchema, { name: '', description: '' });
  const fail = (err) => showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');

  const onCreate = async (v) => {
    const ok = await confirm({ title: `Create department “${v.name.trim()}”?`, message: 'It counts toward your plan’s department limit.', confirmLabel: 'Create department', icon: Plus });
    if (!ok) return;
    try { await create.mutateAsync({ name: v.name, description: v.description || undefined }); showToast('Department created.', 'success'); reset(); setShowForm(false); } catch (e) { fail(e); }
  };
  const onEdit = async (v) => {
    const ok = await confirm({ title: `Save changes to ${editing.name}?`, message: 'The department name and description will be updated for everyone in your organization.', confirmLabel: 'Save changes', icon: Save });
    if (!ok) return;
    try { await updateDepartment.mutateAsync({ id: editing.id, payload: { name: v.name.trim(), description: v.description?.trim() ?? '' } }); showToast('Department updated.', 'success'); setEditing(null); } catch (e) { fail(e); }
  };
  const onDelete = async () => {
    try { await deleteDepartment.mutateAsync(deleting.id); showToast('Department deleted.', 'success'); } catch (e) { fail(e); } finally { setDeleting(null); }
  };

  return (
    <Card padded={false}>
      <div style={{ padding: 'var(--space-5)' }}>
        <CardHeader icon={Building} title="Departments" subtitle="Contributors belong to exactly one department; their entries are scoped to it." actions={<Button icon={showForm ? X : Plus} variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'New department'}</Button>} />
        {showForm && (
          <form onSubmit={handleSubmit(onCreate)} noValidate>
            <div className="split-2">
              <FormField label="Name" error={errors.name} required><TextInput placeholder="e.g. Fleet & Logistics" error={errors.name} {...register('name')} /></FormField>
              <FormField label="Description"><TextInput placeholder="What does this department do?" {...register('description')} /></FormField>
            </div>
            <Button type="submit" icon={Plus} loading={isSubmitting}>Create department</Button>
          </form>
        )}
      </div>

      {departments.length === 0 ? <EmptyState icon={Building} title="No departments yet" /> : (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Department</th><th>Description</th><th className="num">Active staff</th><th></th></tr></thead>
            <tbody>
              {departments.map((d) => {
                const staff = users.filter((u) => u.departmentId === d.id && u.isActive);
                const open = openId === d.id;
                return (
                  <Fragment key={d.id}>
                    <tr>
                      <td><strong>{d.name}</strong></td>
                      <td className="text-muted">{d.description || '—'}</td>
                      <td className="num">{staff.length}</td>
                      <td>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <Button variant="ghost" size="sm" icon={open ? EyeOff : Eye} onClick={() => setOpenId(open ? null : d.id)}>{open ? 'Hide staff' : 'View staff'}</Button>
                          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => { setEditing(d); edit.reset({ name: d.name, description: d.description ?? '' }); }}>Edit</Button>
                          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleting(d)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={4}>
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
      )}

      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Edit department" width={440}>
        <form onSubmit={edit.handleSubmit(onEdit)} noValidate>
          <FormField label="Name" error={edit.formState.errors.name} required><TextInput placeholder="Department name" error={edit.formState.errors.name} {...edit.register('name')} /></FormField>
          <FormField label="Description"><TextInput placeholder="Description" {...edit.register('description')} /></FormField>
          <Button type="submit" icon={Save} loading={updateDepartment.isPending}>Save changes</Button>
        </form>
      </Drawer>

      <Drawer open={!!inviteFor} onClose={() => setInviteFor(null)} title={`Add contributor to ${inviteFor?.name ?? ''}`} width={460}>
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
  const [filter, setFilter] = useState('');
  const [deactivating, setDeactivating] = useState(null);
  const fail = (err) => showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
  const deptName = (id) => departments.find((d) => d.id === id)?.name ?? '—';
  const shown = users.filter((u) => !filter || u.role === filter);

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
          <FormField label="Role">
            <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All roles</option>
              {Object.entries(ORG_ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </FormField>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Last sign-in</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}{u.isOwner ? <span className="text-muted"> (Owner)</span> : ''}</td>
                <td>{u.email}</td>
                <td>{ORG_ROLE_LABELS[u.role]}</td>
                <td>
                  {u.role === 'CONTRIBUTOR' ? (
                    <Select aria-label={`Department for ${u.fullName}`} value={u.departmentId ?? ''} onChange={(e) => moveTo(u, e.target.value)} disabled={!u.isActive}>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                  ) : <span className="text-muted">Organization-wide</span>}
                </td>
                <td>{fmtDate(u.lastLogin)}</td>
                <td><StatusBadge status={u.isActive ? 'ACTIVE' : 'SUSPENDED'} label={u.isActive ? 'Active' : 'Inactive'} /></td>
                <td>
                  {u.id !== me.sub && (u.isActive
                    ? <Button variant="ghost" size="sm" icon={UserX} onClick={() => setDeactivating(u)}>Deactivate</Button>
                    : <Button variant="ghost" size="sm" icon={UserCheck} onClick={() => reactivate(u)}>Reactivate</Button>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={showInvite} onClose={() => setShowInvite(false)} title="Invite a team member" width={460}>
        <InviteForm departments={departments} onDone={() => setShowInvite(false)} />
      </Drawer>
      <ConfirmDialog open={!!deactivating} title={`Deactivate ${deactivating?.fullName}?`} message="They will no longer be able to sign in. Their history is preserved and you can reactivate them later." confirmLabel="Deactivate" danger loading={updateUser.isPending} onConfirm={() => setActive(deactivating, false)} onCancel={() => setDeactivating(null)} />
    </Card>
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
