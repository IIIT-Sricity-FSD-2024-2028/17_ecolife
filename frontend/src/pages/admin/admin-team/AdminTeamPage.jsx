import { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  UserMinus,
  UserCheck,
  Pencil,
  KeyRound,
  Unlock,
  Lock,
  Trash2,
  RotateCcw,
  Search,
  AlertTriangle,
  Crown,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAdminTeam, useAdminMutations } from '../../../hooks/useAdminData';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useZodForm } from '../../../hooks/useZodForm';
import {
  adminInviteSchema,
  adminUpdateSchema,
  adminResetPasswordSchema,
} from '../../../schemas/formSchemas';
import { Card, CardHeader } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Drawer } from '../../../components/ui/Drawer';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { DetailList } from '../../../components/shared/DetailList';
import { EmptyState } from '../../../components/shared/EmptyState';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { PasswordRules } from '../../../components/ui/PasswordRules';
import { FormField, TextInput, Select, PasswordInput } from '../../../components/ui/FormField';
import { rowProps } from '../../../components/shared/rowProps';
import { fmtDate, fmtDateTime } from '../../../utils/format';
import { PLATFORM_ROLE_LABELS } from '../../../constants/roles';
import { ADMIN_ROUTES } from '../../../constants/routes';
import { ApiError } from '../../../services/apiClient';

/** Generates a high-entropy password that automatically satisfies all complexity rules */
function generateStrongPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const specials = '!@#$%^&*()_+~';
  const all = upper + lower + digits + specials;

  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += specials[Math.floor(Math.random() * specials.length)];

  for (let i = 0; i < 10; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

export function AdminTeamPage() {
  const { admin: currentAdmin } = useAdminAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { data: admins = [], isLoading } = useAdminTeam();
  const mutations = useAdminMutations();

  // Search & filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  // Dialog & drawer states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editAdmin, setEditAdmin] = useState(null);
  const [resetPassAdmin, setResetPassAdmin] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [targetDelete, setTargetDelete] = useState(null);
  const [targetPurge, setTargetPurge] = useState(null);

  // Super Admin security barrier defense-in-depth
  if (currentAdmin?.role !== 'SUPER_ADMIN') {
    return (
      <div style={{ maxWidth: '600px', margin: 'var(--space-8) auto' }}>
        <Card style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}
          >
            <ShieldAlert size={28} />
          </div>
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Super Admin Restricted</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
            The Admin Team console manages portal administrative authority and security credentials. Platform
            administrators do not have operational permissions to modify other administrators.
          </p>
          <Button variant="primary" onClick={() => (window.location.href = ADMIN_ROUTES.DASHBOARD)}>
            Return to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // Active Super Admins count to protect the Last Super Admin invariant
  const activeSuperAdmins = useMemo(() => {
    return admins.filter((a) => a.role === 'SUPER_ADMIN' && a.isActive && !a.deletedAt);
  }, [admins]);

  const activeSuperAdminsCount = activeSuperAdmins.length;

  // Selected admin for detail drawer
  const selected = useMemo(() => admins.find((a) => a.id === selectedId) ?? null, [admins, selectedId]);
  const invitedBy = useMemo(() => {
    if (!selected?.invitedById) return null;
    return admins.find((a) => a.id === selected.invitedById)?.fullName || null;
  }, [admins, selected]);

  // Filtered list
  const filteredAdmins = useMemo(() => {
    return admins.filter((a) => {
      if (!showDeleted && a.deletedAt) return false;
      if (roleFilter && a.role !== roleFilter) return false;
      if (statusFilter === 'ACTIVE' && (!a.isActive || a.deletedAt)) return false;
      if (statusFilter === 'SUSPENDED' && (a.isActive || a.deletedAt)) return false;
      if (statusFilter === 'LOCKED' && (!a.lockedUntil || new Date(a.lockedUntil) <= new Date())) return false;
      if (statusFilter === 'DELETED' && !a.deletedAt) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = a.fullName?.toLowerCase().includes(q);
        const matchesEmail = a.email?.toLowerCase().includes(q);
        const matchesJob = a.jobTitle?.toLowerCase().includes(q);
        const matchesPhone = a.phone?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesJob && !matchesPhone) return false;
      }
      return true;
    });
  }, [admins, showDeleted, roleFilter, statusFilter, search]);

  const isSelf = (admin) =>
    currentAdmin?.sub === admin?.id ||
    currentAdmin?.id === admin?.id ||
    currentAdmin?.email?.toLowerCase() === admin?.email?.toLowerCase();

  const isLastSuperAdmin = (admin) =>
    admin?.role === 'SUPER_ADMIN' && admin?.isActive && !admin?.deletedAt && activeSuperAdminsCount <= 1;

  // Handlers
  const handleToggleActive = async (admin) => {
    if (isSelf(admin)) {
      showToast('You cannot deactivate your own administrative account.', 'error');
      return;
    }
    if (admin.isActive && isLastSuperAdmin(admin)) {
      showToast('Cannot deactivate the last remaining Super Admin.', 'error');
      return;
    }

    const nextState = !admin.isActive;
    const ok = await confirm({
      title: `${nextState ? 'Reactivate' : 'Suspend'} ${admin.fullName}?`,
      message: nextState
        ? 'They will regain complete administrative access to this portal.'
        : 'They will immediately lose access to this admin portal and all active sessions will be revoked.',
      confirmLabel: nextState ? 'Reactivate' : 'Suspend access',
      danger: !nextState,
      icon: nextState ? UserCheck : UserMinus,
    });
    if (!ok) return;

    try {
      await mutations.updateAdmin.mutateAsync({
        id: admin.id,
        payload: { isActive: nextState },
      });
      showToast(`Admin ${admin.fullName} ${nextState ? 'reactivated' : 'suspended'}.`, 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Action failed.', 'error');
    }
  };

  const handleUnlock = async (admin) => {
    try {
      await mutations.updateAdmin.mutateAsync({
        id: admin.id,
        payload: { unlock: true },
      });
      showToast(`Account for ${admin.fullName} unlocked successfully.`, 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to unlock account.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!targetDelete) return;
    try {
      await mutations.removeAdmin.mutateAsync(targetDelete.id);
      showToast(`Admin ${targetDelete.fullName} removed from active team.`, 'success');
      if (selectedId === targetDelete.id) setSelectedId(null);
      setTargetDelete(null);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to remove admin.', 'error');
    }
  };

  const handleRestore = async (admin) => {
    try {
      await mutations.restoreAdmin.mutateAsync(admin.id);
      showToast(`Admin ${admin.fullName} restored.`, 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to restore admin.', 'error');
    }
  };

  const handlePurge = async () => {
    if (!targetPurge) return;
    try {
      await mutations.purgeAdmin.mutateAsync(targetPurge.id);
      showToast(`Admin ${targetPurge.fullName} permanently purged.`, 'success');
      if (selectedId === targetPurge.id) setSelectedId(null);
      setTargetPurge(null);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to purge admin.', 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Admin Team"
        subtitle="Manage platform super administrators and administrators with role-based governance and security controls."
        actions={
          <Button icon={UserPlus} variant="primary" onClick={() => setShowInviteModal(true)}>
            Invite Admin
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="Administrators"
          subtitle="All platform personnel with elevated portal access."
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search by name, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3) var(--space-2) 32px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-sm)',
                    background: 'var(--color-surface)',
                  }}
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-sm)',
                  background: 'var(--color-surface)',
                }}
              >
                <option value="">All Roles</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="PLATFORM_ADMIN">Platform Admin</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-sm)',
                  background: 'var(--color-surface)',
                }}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="LOCKED">Locked Out</option>
                <option value="DELETED">Deactivated / Deleted</option>
              </select>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  fontSize: 'var(--font-size-sm)',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                }}
              >
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Show Inactive / Deleted
              </label>
            </div>
          }
        />

        {isLoading ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Loading administrator directory...
          </div>
        ) : filteredAdmins.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No administrators found"
            description={
              search || roleFilter || statusFilter
                ? 'Try adjusting your filters or search keywords.'
                : 'No other platform administrators exist yet.'
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last sign-in</th>
                  <th>Admin since</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map((a) => {
                  const self = isSelf(a);
                  const isLocked = a.lockedUntil && new Date(a.lockedUntil) > new Date();
                  const lastSuper = isLastSuperAdmin(a);
                  const isDeleted = !!a.deletedAt;

                  return (
                    <tr
                      key={a.id}
                      style={isDeleted ? { opacity: 0.65 } : {}}
                      {...rowProps(() => setSelectedId(a.id))}
                    >
                      <td>
                        <strong>{a.fullName}</strong>
                        {self && (
                          <span
                            className="text-muted"
                            style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}
                          >
                            (You)
                          </span>
                        )}
                        {a.jobTitle && (
                          <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                            {a.jobTitle}
                          </div>
                        )}
                      </td>

                      <td>{a.email}</td>

                      <td>{PLATFORM_ROLE_LABELS[a.role] ?? a.role}</td>

                      <td>
                        {isDeleted ? (
                          <StatusBadge status="REJECTED" label="Deactivated" />
                        ) : isLocked ? (
                          <StatusBadge status="REJECTED" label="Locked Out" />
                        ) : a.isActive ? (
                          <StatusBadge status="ACTIVE" label="Active" />
                        ) : (
                          <StatusBadge status="SUSPENDED" label="Suspended" />
                        )}
                      </td>

                      <td className="text-muted">{a.lastLogin ? fmtDateTime(a.lastLogin) : 'Never'}</td>

                      <td className="text-muted">{fmtDate(a.createdAt)}</td>

                      <td>
                        <div
                          className="row-actions"
                          style={{ justifyContent: 'flex-end', display: 'flex', gap: 'var(--space-1)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isLocked && (
                            <Button variant="ghost-success" size="sm" onClick={() => handleUnlock(a)}>
                              Unlock
                            </Button>
                          )}

                          {!isDeleted && (
                            <>
                              <Button variant="ghost-info" size="sm" onClick={() => setEditAdmin(a)}>
                                Edit
                              </Button>

                              <Button variant="ghost-info" size="sm" onClick={() => setResetPassAdmin(a)}>
                                Reset Password
                              </Button>

                              {!self && !lastSuper && (
                                <Button
                                  variant={a.isActive ? 'ghost-danger' : 'ghost-success'}
                                  size="sm"
                                  onClick={() => handleToggleActive(a)}
                                >
                                  {a.isActive ? 'Suspend' : 'Activate'}
                                </Button>
                              )}

                              {!self && !lastSuper && (
                                <Button
                                  variant="ghost-danger"
                                  size="sm"
                                  onClick={() => setTargetDelete(a)}
                                >
                                  Remove
                                </Button>
                              )}
                            </>
                          )}

                          {isDeleted && (
                            <>
                              <Button variant="ghost-success" size="sm" onClick={() => handleRestore(a)}>
                                Restore
                              </Button>
                              {!self && (
                                <Button
                                  variant="ghost-danger"
                                  size="sm"
                                  onClick={() => setTargetPurge(a)}
                                >
                                  Purge
                                </Button>
                              )}
                            </>
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
      </Card>

      {/* DRAWER: ADMIN DETAIL VIEW */}
      <Drawer
        open={!!selected}
        title={selected?.fullName}
        subtitle={selected ? PLATFORM_ROLE_LABELS[selected.role] : ''}
        onClose={() => setSelectedId(null)}
        footer={
          selected && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditAdmin(selected)}>
                  Edit
                </Button>
                <Button variant="secondary" size="sm" icon={KeyRound} onClick={() => setResetPassAdmin(selected)}>
                  Reset Password
                </Button>
                {selected.lockedUntil && new Date(selected.lockedUntil) > new Date() && (
                  <Button variant="secondary" size="sm" icon={Unlock} onClick={() => handleUnlock(selected)}>
                    Unlock
                  </Button>
                )}
              </div>
              {!isSelf(selected) && !isLastSuperAdmin(selected) && !selected.deletedAt && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setTargetDelete(selected)}
                >
                  Remove Admin
                </Button>
              )}
            </div>
          )
        }
      >
        {selected && (
          <div>
            <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              {selected.deletedAt ? (
                <StatusBadge status="REJECTED" label="Deactivated" />
              ) : selected.lockedUntil && new Date(selected.lockedUntil) > new Date() ? (
                <StatusBadge status="REJECTED" label={`Locked until ${fmtDateTime(selected.lockedUntil)}`} />
              ) : selected.isActive ? (
                <StatusBadge status="ACTIVE" label="Active" />
              ) : (
                <StatusBadge status="SUSPENDED" label="Suspended" />
              )}

              {isSelf(selected) && (
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: 'var(--color-primary-light)',
                    color: 'var(--color-primary-dark)',
                    fontWeight: 'bold',
                  }}
                >
                  Your Account
                </span>
              )}
            </div>

            <DetailList
              items={[
                ['Full Name', selected.fullName],
                ['Email Address', selected.email],
                ['Administrative Role', PLATFORM_ROLE_LABELS[selected.role]],
                ['Phone Number', selected.phone || '—'],
                ['Job Title', selected.jobTitle || '—'],
                ['Sign-in Status', selected.isActive ? 'Permitted' : 'Access Suspended'],
                ['Last Portal Sign-in', selected.lastLogin ? fmtDateTime(selected.lastLogin) : 'Never'],
                ['Password Last Changed', selected.passwordChangedAt ? fmtDateTime(selected.passwordChangedAt) : 'Never'],
                ['Failed Logins', selected.failedLoginCount || 0],
                [
                  'Lockout Status',
                  selected.lockedUntil && new Date(selected.lockedUntil) > new Date()
                    ? `Locked until ${fmtDateTime(selected.lockedUntil)}`
                    : 'Clear',
                ],
                ['Invited By', invitedBy ?? (selected.invitedById ? 'Former administrator' : 'Initial setup / System')],
                ['Account Created', fmtDateTime(selected.createdAt)],
                ['Last Profile Update', fmtDateTime(selected.updatedAt)],
                ['Administrator UUID', <code key="id">{selected.id}</code>],
              ]}
            />
          </div>
        )}
      </Drawer>

      {/* INVITE ADMIN MODAL */}
      <InviteAdminModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        mutation={mutations.inviteAdmin}
      />

      {/* EDIT ADMIN MODAL */}
      {editAdmin && (
        <EditAdminModal
          open={!!editAdmin}
          admin={editAdmin}
          currentAdmin={currentAdmin}
          activeSuperAdminsCount={activeSuperAdminsCount}
          onClose={() => setEditAdmin(null)}
          mutation={mutations.updateAdmin}
        />
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPassAdmin && (
        <ResetPasswordModal
          open={!!resetPassAdmin}
          admin={resetPassAdmin}
          onClose={() => setResetPassAdmin(null)}
          mutation={mutations.updateAdmin}
        />
      )}

      {/* DELETE / REMOVE CONFIRM DIALOG */}
      <ConfirmDialog
        open={!!targetDelete}
        title={`Remove ${targetDelete?.fullName}?`}
        message={
          <div>
            <p style={{ marginBottom: 'var(--space-3)' }}>
              Are you sure you want to deactivate <strong>{targetDelete?.fullName}</strong> ({targetDelete?.email})?
            </p>
            <div
              style={{
                padding: 'var(--space-3)',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-muted)',
              }}
            >
              <Info size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
              They will immediately lose portal access and their active sessions will be terminated. Historical audit
              logs and actions recorded by this administrator will be preserved.
            </div>
          </div>
        }
        confirmLabel="Deactivate Admin"
        danger
        icon={UserMinus}
        loading={mutations.removeAdmin.isPending}
        onConfirm={handleDelete}
        onCancel={() => setTargetDelete(null)}
      />

      {/* PURGE CONFIRM DIALOG */}
      <ConfirmDialog
        open={!!targetPurge}
        title={`Permanently purge ${targetPurge?.fullName}?`}
        message={
          <div>
            <p style={{ marginBottom: 'var(--space-3)', color: 'var(--color-danger)' }}>
              This action cannot be undone. This administrator record will be permanently deleted from the database.
            </p>
          </div>
        }
        confirmLabel="Purge Permanently"
        danger
        icon={Trash2}
        loading={mutations.purgeAdmin.isPending}
        onConfirm={handlePurge}
        onCancel={() => setTargetPurge(null)}
      />
    </>
  );
}

// =========================================================================
// Invite Administrator Modal
// =========================================================================
function InviteAdminModal({ open, onClose, mutation }) {
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useZodForm(adminInviteSchema, {
    fullName: '',
    email: '',
    role: 'PLATFORM_ADMIN',
    temporaryPassword: '',
    phone: '',
    jobTitle: '',
  });

  const tempPass = watch('temporaryPassword');
  const selectedRole = watch('role');

  const handleGenerate = () => {
    const pwd = generateStrongPassword();
    setValue('temporaryPassword', pwd, { shouldValidate: true });
    showToast('High-entropy password generated.', 'info');
  };

  const onSubmit = async (values) => {
    try {
      await mutation.mutateAsync({
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        role: values.role,
        temporaryPassword: values.temporaryPassword,
        phone: values.phone?.trim() || undefined,
        jobTitle: values.jobTitle?.trim() || undefined,
      });
      showToast(`Administrator ${values.fullName} invited successfully.`, 'success');
      reset();
      onClose();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to invite administrator.', 'error');
    }
  };

  return (
    <Drawer
      variant="modal"
      open={open}
      title="Invite Platform Administrator"
      subtitle="Create a new administrator account and provision security credentials."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Full Name" error={errors.fullName} required>
          <TextInput placeholder="Jane Doe" error={errors.fullName} {...register('fullName')} />
        </FormField>

        <FormField label="Email Address" error={errors.email} required>
          <TextInput
            type="email"
            autoComplete="off"
            placeholder="admin@tropos.dev"
            error={errors.email}
            {...register('email')}
          />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <FormField label="Job Title" error={errors.jobTitle}>
            <TextInput placeholder="Security Lead" error={errors.jobTitle} {...register('jobTitle')} />
          </FormField>
          <FormField label="Phone" error={errors.phone}>
            <TextInput placeholder="+1 555-0199" error={errors.phone} {...register('phone')} />
          </FormField>
        </div>

        <FormField label="Administrative Authority (Role)" error={errors.role} required>
          <Select error={errors.role} {...register('role')}>
            <option value="PLATFORM_ADMIN">Platform Admin — Operational governance</option>
            <option value="SUPER_ADMIN">Super Admin — Complete platform authority</option>
          </Select>
        </FormField>

        {/* Role Explanation Card */}
        <div
          style={{
            padding: 'var(--space-3)',
            background: selectedRole === 'SUPER_ADMIN' ? '#f5f3ff' : '#eff6ff',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${selectedRole === 'SUPER_ADMIN' ? '#ddd6fe' : '#bfdbfe'}`,
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          {selectedRole === 'SUPER_ADMIN' ? (
            <div style={{ color: '#5b21b6' }}>
              <Crown size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              <strong>Super Administrator Privileges:</strong> Full unrestricted access across the entire platform,
              including managing administrator team members, security policies, system configuration, and billing.
            </div>
          ) : (
            <div style={{ color: '#1e40af' }}>
              <ShieldCheck size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              <strong>Platform Administrator Privileges:</strong> Manages organizations, users, departments, emission
              factors, and audits. <em>Cannot create, edit, or remove other platform administrators.</em>
            </div>
          )}
        </div>

        <FormField
          label="Temporary Initial Password"
          error={errors.temporaryPassword}
          required
          hint="Must contain uppercase, lowercase, and a number (minimum 8 characters)."
        >
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <div style={{ flex: 1 }}>
              <PasswordInput
                autoComplete="new-password"
                placeholder="Initial password"
                error={errors.temporaryPassword}
                {...register('temporaryPassword')}
              />
            </div>
            <Button type="button" variant="secondary" icon={Sparkles} onClick={handleGenerate}>
              Generate
            </Button>
          </div>
        </FormField>

        <PasswordRules value={tempPass} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={UserPlus} loading={isSubmitting}>
            Create Admin
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

// =========================================================================
// Edit Administrator Modal
// =========================================================================
function EditAdminModal({ open, onClose, admin, currentAdmin, activeSuperAdminsCount, mutation }) {
  const { showToast } = useToast();
  const isSelf = currentAdmin?.sub === admin?.id || currentAdmin?.id === admin?.id;
  const isLastSuper =
    admin?.role === 'SUPER_ADMIN' && admin?.isActive && !admin?.deletedAt && activeSuperAdminsCount <= 1;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useZodForm(adminUpdateSchema, {
    fullName: admin?.fullName || '',
    email: admin?.email || '',
    role: admin?.role || 'PLATFORM_ADMIN',
    phone: admin?.phone || '',
    jobTitle: admin?.jobTitle || '',
    isActive: admin?.isActive ?? true,
  });

  useEffect(() => {
    if (admin) {
      reset({
        fullName: admin.fullName || '',
        email: admin.email || '',
        role: admin.role || 'PLATFORM_ADMIN',
        phone: admin.phone || '',
        jobTitle: admin.jobTitle || '',
        isActive: admin.isActive ?? true,
      });
    }
  }, [admin, reset]);

  const selectedRole = watch('role');

  const onSubmit = async (values) => {
    try {
      const payload = {
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone?.trim() || '',
        jobTitle: values.jobTitle?.trim() || '',
      };

      if (!isSelf && !isLastSuper) {
        payload.role = values.role;
        payload.isActive = values.isActive === true || values.isActive === 'true';
      }

      await mutation.mutateAsync({ id: admin.id, payload });
      showToast(`Administrator ${values.fullName} updated successfully.`, 'success');
      onClose();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to update administrator.', 'error');
    }
  };

  return (
    <Drawer
      variant="modal"
      open={open}
      title={`Edit Administrator: ${admin?.fullName}`}
      subtitle="Update identity profile, contact information, role, and active status."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Full Name" error={errors.fullName} required>
          <TextInput placeholder="Jane Doe" error={errors.fullName} {...register('fullName')} />
        </FormField>

        <FormField label="Email Address" error={errors.email} required>
          <TextInput
            type="email"
            autoComplete="off"
            placeholder="admin@tropos.dev"
            error={errors.email}
            {...register('email')}
          />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <FormField label="Job Title" error={errors.jobTitle}>
            <TextInput placeholder="Security Architect" error={errors.jobTitle} {...register('jobTitle')} />
          </FormField>
          <FormField label="Phone" error={errors.phone}>
            <TextInput placeholder="+1 555-0199" error={errors.phone} {...register('phone')} />
          </FormField>
        </div>

        <FormField
          label="Role"
          error={errors.role}
          required
          hint={
            isSelf
              ? 'You cannot modify your own administrative role.'
              : isLastSuper
              ? 'Cannot demote the last remaining active Super Admin.'
              : 'Choose level of administrative authority.'
          }
        >
          <Select disabled={isSelf || isLastSuper} error={errors.role} {...register('role')}>
            <option value="PLATFORM_ADMIN">Platform Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </Select>
        </FormField>

        {/* Protection alert if role modification is locked */}
        {(isSelf || isLastSuper) && (
          <div
            style={{
              padding: 'var(--space-2) var(--space-3)',
              background: '#fef3c7',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #fde68a',
              marginBottom: 'var(--space-4)',
              fontSize: 'var(--font-size-xs)',
              color: '#92400e',
            }}
          >
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
            {isSelf
              ? 'Role and status changes are disabled on your own account to prevent accidental lockout.'
              : 'This administrator is the sole remaining active Super Admin and cannot be demoted or deactivated.'}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

// =========================================================================
// Reset Password Modal
// =========================================================================
function ResetPasswordModal({ open, onClose, admin, mutation }) {
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useZodForm(adminResetPasswordSchema, {
    temporaryPassword: '',
  });

  const tempPass = watch('temporaryPassword');

  const handleGenerate = () => {
    const pwd = generateStrongPassword();
    setValue('temporaryPassword', pwd, { shouldValidate: true });
    showToast('High-entropy password generated.', 'info');
  };

  const onSubmit = async (values) => {
    try {
      await mutation.mutateAsync({
        id: admin.id,
        payload: { temporaryPassword: values.temporaryPassword },
      });
      showToast(`Temporary password for ${admin.fullName} has been updated.`, 'success');
      reset();
      onClose();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to reset password.', 'error');
    }
  };

  return (
    <Drawer
      variant="modal"
      open={open}
      title="Reset Administrator Credentials"
      subtitle={`Set a new temporary password for ${admin?.fullName} (${admin?.email}).`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div
          style={{
            padding: 'var(--space-3)',
            background: '#eff6ff',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #bfdbfe',
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--font-size-xs)',
            color: '#1e40af',
          }}
        >
          <KeyRound size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
          Setting a new temporary password will immediately invalidate all currently active JWT sign-in sessions for
          this administrator.
        </div>

        <FormField label="New Temporary Password" error={errors.temporaryPassword} required>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <div style={{ flex: 1 }}>
              <PasswordInput
                autoComplete="new-password"
                placeholder="New temporary password"
                error={errors.temporaryPassword}
                {...register('temporaryPassword')}
              />
            </div>
            <Button type="button" variant="secondary" icon={Sparkles} onClick={handleGenerate}>
              Generate
            </Button>
          </div>
        </FormField>

        <PasswordRules value={tempPass} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={KeyRound} loading={isSubmitting}>
            Update Password
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
