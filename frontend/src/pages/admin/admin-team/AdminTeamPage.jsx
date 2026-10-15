import { useState } from 'react';
import { UserPlus, UserMinus, Send, X } from 'lucide-react';
import { useZodForm } from '../../../hooks/useZodForm';
import { adminInviteSchema } from '../../../schemas/formSchemas';
import { PasswordRules } from '../../../components/ui/PasswordRules';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformAdminService } from '../../../services/platformAdminService';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { FormField, TextInput, Select, PasswordInput } from '../../../components/ui/FormField';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { PLATFORM_ROLE_LABELS } from '../../../constants/roles';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Drawer } from '../../../components/ui/Drawer';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { DetailList } from '../../../components/shared/DetailList';
import { rowProps } from '../../../components/shared/rowProps';
import { fmtDate, fmtDateTime } from '../../../utils/format';

export function AdminTeamPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const { data: admins, isLoading } = useQuery({ queryKey: ['platform-admins'], queryFn: platformAdminService.listAdmins });
  const invite = useMutation({
    mutationFn: platformAdminService.inviteAdmin,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-admins'] }),
  });
  const selected = admins?.find((a) => a.id === selectedId) ?? null;
  const invitedBy = selected?.invitedById ? admins?.find((a) => a.id === selected.invitedById)?.fullName : null;
  const remove = useMutation({
    mutationFn: platformAdminService.removeAdmin,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-admins'] }),
  });
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useZodForm(adminInviteSchema, { email: '', fullName: '', role: '', temporaryPassword: '' });
  const tempPassword = watch('temporaryPassword');

  const onSubmit = async (values) => {
    const ok = await confirm({
      title: `Invite ${values.fullName || values.email} as ${PLATFORM_ROLE_LABELS[values.role] ?? 'admin'}?`,
      message: 'They will get full access to the platform admin portal with the temporary password you set.',
      confirmLabel: 'Send invite',
      icon: UserPlus,
    });
    if (!ok) return;
    try {
      await invite.mutateAsync(values);
      showToast('Admin invited.', 'success');
      reset();
      setShowForm(false);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
    }
  };

  const handleRemove = async (admin) => {
    const ok = await confirm({
      title: `Remove ${admin.fullName}?`,
      message: 'They will immediately lose access to the admin portal. This cannot be undone.',
      confirmLabel: 'Remove admin',
      danger: true,
      icon: UserMinus,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(admin.id);
      showToast('Admin removed.', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
    }
  };

  return (
    <>
      <PageHeader subtitle="People who can sign in to this admin portal. Only Super Admins can invite or deactivate admins." actions={<Button icon={showForm ? X : UserPlus} variant={showForm ? 'secondary' : 'primary'} onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Invite admin'}</Button>} />
      <Card>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} style={{ marginBottom: 'var(--space-5)' }} noValidate>
          <FormField label="Email" error={errors.email} required>
            <TextInput type="email" autoComplete="off" placeholder="name@company.com" error={errors.email} {...register('email')} />
          </FormField>
          <FormField label="Full name" error={errors.fullName} required>
            <TextInput placeholder="Their full name" error={errors.fullName} {...register('fullName')} />
          </FormField>
          <FormField label="Role" error={errors.role} required>
            <Select error={errors.role} {...register('role')}>
              <option value="">Select…</option>
              <option value="PLATFORM_ADMIN">Platform Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </Select>
          </FormField>
          <FormField label="Temporary password" error={errors.temporaryPassword} required>
            <PasswordInput autoComplete="new-password" placeholder="Set a temporary password" error={errors.temporaryPassword} {...register('temporaryPassword')} />
          </FormField>
          <PasswordRules value={tempPassword} />
          <Button type="submit" icon={Send} loading={isSubmitting}>Send invite</Button>
        </form>
      )}

      {!isLoading && admins?.length > 0 && (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} {...rowProps(() => setSelectedId(a.id))}>
                <td>{a.fullName}</td>
                <td>{a.email}</td>
                <td>{PLATFORM_ROLE_LABELS[a.role]}</td>
                <td><Button variant="ghost" size="sm" icon={UserMinus} onClick={(e) => { e.stopPropagation(); handleRemove(a); }}>Remove</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
    <Drawer
      open={!!selected}
      title={selected?.fullName}
      subtitle={selected ? PLATFORM_ROLE_LABELS[selected.role] : ''}
      onClose={() => setSelectedId(null)}
      footer={selected && <Button variant="danger" icon={UserMinus} onClick={() => handleRemove(selected)}>Remove admin</Button>}
    >
      {selected && (
        <>
          <p style={{ marginBottom: 'var(--space-4)' }}>
            {selected.lockedUntil && new Date(selected.lockedUntil) > new Date()
              ? <StatusBadge status="REJECTED" label={`Locked until ${fmtDateTime(selected.lockedUntil)}`} />
              : <StatusBadge status="ACTIVE" label="Active" />}
          </p>
          <DetailList items={[
            ['Email', selected.email],
            ['Phone', selected.phone],
            ['Job title', selected.jobTitle],
            ['Role', PLATFORM_ROLE_LABELS[selected.role]],
            ['Last sign-in', selected.lastLogin ? fmtDateTime(selected.lastLogin) : 'Never'],
            ['Password changed', selected.passwordChangedAt ? fmtDateTime(selected.passwordChangedAt) : 'Not since the account was created'],
            ['Admin since', fmtDate(selected.createdAt)],
            ['Invited by', invitedBy ?? (selected.invitedById ? 'Former admin' : 'Created at setup')],
            ['Admin ID', <code key="id">{selected.id}</code>],
          ]} />
        </>
      )}
    </Drawer>
    </>
  );
}
