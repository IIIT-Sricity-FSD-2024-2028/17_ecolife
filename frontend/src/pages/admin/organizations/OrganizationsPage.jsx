import { useState } from 'react';
import {
  Ban,
  RotateCcw,
  SearchX,
  Plus,
  Pencil,
  Trash2,
  Building2,
  Briefcase,
  Users,
  UserPlus,
  UserMinus,
  Save,
  AlertTriangle,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import {
  useAdminOrganizations,
  useAdminPlans,
  useAdminMutations,
  useAdminOrgDepartments,
  useAdminOrgUsers,
} from '../../../hooks/useAdminData';
import { useZodForm } from '../../../hooks/useZodForm';
import {
  createOrgSchema,
  updateOrgSchema,
  departmentSchema,
  adminCreateOrgUserSchema,
  editUserSchema,
} from '../../../schemas/formSchemas';
import { Card, CardHeader } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { FormField, TextInput, Select, TextArea, PasswordInput } from '../../../components/ui/FormField';
import { Checkbox } from '../../../components/ui/Checkbox';
import { PasswordRules } from '../../../components/ui/PasswordRules';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { Drawer } from '../../../components/ui/Drawer';
import { Tabs } from '../../../components/ui/Tabs';
import { DetailList } from '../../../components/shared/DetailList';
import { rowProps } from '../../../components/shared/rowProps';
import { ORG_ROLE_LABELS } from '../../../constants/roles';
import { fmtDate, fmtDateTime, fmtMoney } from '../../../utils/format';

const lim = (n) => (!n || n >= 999 ? 'Unlimited' : n);

export function OrganizationsPage() {
  const { data: orgs = [], isLoading } = useAdminOrganizations();
  const { data: plans = [] } = useAdminPlans();
  const mutations = useAdminMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();

  // Filters & Selected State
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [selectedId, setSelectedId] = useState(null);
  const [drawerTab, setDrawerTab] = useState('overview');

  // Modal Dialog States
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showEditOrg, setShowEditOrg] = useState(false);
  const [targetSuspend, setTargetSuspend] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [targetDeleteOrg, setTargetDeleteOrg] = useState(null);
  const [targetPurgeOrg, setTargetPurgeOrg] = useState(null);

  // Department Modals & Targets
  const [deptModal, setDeptModal] = useState({ open: false, mode: 'create', dept: null });
  const [targetDeleteDept, setTargetDeleteDept] = useState(null);

  // User Modals & Targets
  const [userModal, setUserModal] = useState({ open: false, mode: 'create', user: null });
  const [targetDeactivateUser, setTargetDeactivateUser] = useState(null);

  const selected = orgs.find((o) => o.id === selectedId) ?? null;

  // Department & User queries for the selected organization
  const { data: orgDepartments = [], isLoading: loadingDepts } = useAdminOrgDepartments(selected?.id);
  const { data: orgUsers = [], isLoading: loadingUsers } = useAdminOrgUsers(selected?.id);

  const shown = orgs.filter(
    (o) =>
      (!filters.status || o.status === filters.status) &&
      (!filters.q || `${o.name} ${o.ownerEmail ?? ''} ${o.ownerName ?? ''}`.toLowerCase().includes(filters.q.toLowerCase())),
  );

  const handleStatusChange = async (org, status, why) => {
    try {
      await mutations.setOrgStatus.mutateAsync({ id: org.id, status, reason: why });
      showToast(`${org.name} is now ${status.toLowerCase()}.`, 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error');
    } finally {
      setTargetSuspend(null);
      setSuspendReason('');
    }
  };

  const reactivate = async (org) => {
    const ok = await confirm({
      title: `Reactivate ${org.name}?`,
      message: 'Their users will be able to sign in and use Tropos again straight away.',
      confirmLabel: 'Reactivate',
      icon: RotateCcw,
    });
    if (ok) handleStatusChange(org, 'ACTIVE');
  };

  const handleSoftDeleteOrg = async () => {
    if (!targetDeleteOrg) return;
    try {
      await mutations.deleteOrganization.mutateAsync(targetDeleteOrg.id);
      showToast(
        `Organization "${targetDeleteOrg.name}" scheduled for deletion (30-day recovery window).`,
        'success',
      );
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not schedule organization deletion.', 'error');
    } finally {
      setTargetDeleteOrg(null);
    }
  };

  const handleRestoreOrg = async (org) => {
    const ok = await confirm({
      title: `Restore ${org.name}?`,
      message: 'This will cancel the scheduled deletion, restore user logins, and reactivate all operational departments.',
      confirmLabel: 'Restore organization',
      icon: RotateCcw,
    });
    if (!ok) return;
    try {
      await mutations.restoreOrganization.mutateAsync(org.id);
      showToast(`Organization "${org.name}" has been restored to active status.`, 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not restore organization.', 'error');
    }
  };

  const handlePurgeOrg = async () => {
    if (!targetPurgeOrg) return;
    try {
      await mutations.purgeOrganization.mutateAsync(targetPurgeOrg.id);
      showToast(`Organization "${targetPurgeOrg.name}" has been permanently purged.`, 'success');
      if (selectedId === targetPurgeOrg.id) {
        setSelectedId(null);
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not purge organization.', 'error');
    } finally {
      setTargetPurgeOrg(null);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!targetDeleteDept || !selected) return;
    try {
      await mutations.deleteOrgDepartment.mutateAsync({
        orgId: selected.id,
        deptId: targetDeleteDept.id,
      });
      showToast(`Department "${targetDeleteDept.name}" deleted.`, 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not delete department.', 'error');
    } finally {
      setTargetDeleteDept(null);
    }
  };

  const handleDeactivateUser = async () => {
    if (!targetDeactivateUser || !selected) return;
    try {
      await mutations.deactivateOrgUser.mutateAsync({
        orgId: selected.id,
        userId: targetDeactivateUser.id,
      });
      showToast(`User ${targetDeactivateUser.fullName} has been deactivated.`, 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not deactivate user.', 'error');
    } finally {
      setTargetDeactivateUser(null);
    }
  };

  // Quota calculation for selected org
  const selectedMaxDepts = selected?.maxDepartments ?? 999;
  const selectedMaxUsers = selected?.maxUsers ?? 999;
  const isDeptLimitReached = selectedMaxDepts < 999 && orgDepartments.length >= selectedMaxDepts;
  const isUserLimitReached = selectedMaxUsers < 999 && orgUsers.filter((u) => u.isActive).length >= selectedMaxUsers;

  return (
    <div>
      <PageHeader
        subtitle="Manage customer organizations, soft-delete with 30-day recovery grace period, and strictly enforce subscription limits."
        actions={
          <Button icon={Plus} onClick={() => setShowCreateOrg(true)}>
            New organization
          </Button>
        }
      />

      <Card padded={false}>
        <div style={{ padding: 'var(--space-5)' }}>
          <CardHeader
            title={`${shown.length} organization${shown.length === 1 ? '' : 's'}`}
            subtitle="Click any row to manage its departments, users, subscription plan, and 30-day retention policies."
          />
          <div className="filters" style={{ marginBottom: 0 }}>
            <FormField label="Search">
              <TextInput
                placeholder="Name or owner"
                aria-label="Search organizations"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              />
            </FormField>
            <FormField label="Status">
              <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="TRIAL">Trial</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DELETED">Scheduled for deletion</option>
              </Select>
            </FormField>
          </div>
        </div>

        {!isLoading && shown.length === 0 && <EmptyState icon={SearchX} title="No organizations found" />}

        {shown.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Owner</th>
                  <th>Plan</th>
                  <th className="num">Users</th>
                  <th className="num">Depts</th>
                  <th className="num">Entries</th>
                  <th>Last active</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => {
                  const isDeleted = o.status === 'DELETED';
                  const userLimitText = `${o.userCount} / ${lim(o.maxUsers)}`;
                  const deptLimitText = `${o.departmentCount} / ${lim(o.maxDepartments)}`;
                  return (
                    <tr
                      key={o.id}
                      style={isDeleted ? { opacity: 0.75 } : {}}
                      {...rowProps(() => {
                        setSelectedId(o.id);
                        setDrawerTab('overview');
                      })}
                    >
                      <td>
                        <strong>{o.name}</strong>
                        <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                          Since {fmtDate(o.createdAt)}
                        </div>
                      </td>
                      <td>
                        {o.ownerName ?? '—'}
                        <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                          {o.ownerEmail}
                        </div>
                      </td>
                      <td>
                        {o.planName ?? '—'}
                        {o.subscriptionStatus && (
                          <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                            {o.subscriptionStatus.toLowerCase()}
                          </div>
                        )}
                      </td>
                      <td className="num">
                        <span>{userLimitText}</span>
                      </td>
                      <td className="num">
                        <span>{deptLimitText}</span>
                      </td>
                      <td className="num">{o.recordCount}</td>
                      <td>{fmtDate(o.lastActiveAt)}</td>
                      <td>
                        {isDeleted ? (
                          <StatusBadge
                            status="REJECTED"
                            label={`Deleted (${o.daysUntilPurge ?? 30}d left)`}
                          />
                        ) : (
                          <StatusBadge status={o.status} />
                        )}
                      </td>
                      <td>
                        <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                          {isDeleted ? (
                            <>
                              <Button
                                variant="ghost-success"
                                size="sm"
                                onClick={() => handleRestoreOrg(o)}
                              >
                                Restore
                              </Button>
                              <Button
                                variant="ghost-danger"
                                size="sm"
                                onClick={() => setTargetPurgeOrg(o)}
                              >
                                Purge
                              </Button>
                            </>
                          ) : (
                            <>
                              {o.status === 'SUSPENDED' ? (
                                <Button variant="ghost-success" size="sm" onClick={() => reactivate(o)}>
                                  Reactivate
                                </Button>
                              ) : (
                                <Button variant="ghost-danger" size="sm" onClick={() => setTargetSuspend(o)}>
                                  Suspend
                                </Button>
                              )}
                              <Button
                                variant="ghost-danger"
                                size="sm"
                                onClick={() => setTargetDeleteOrg(o)}
                              >
                                Delete
                              </Button>
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

      {/* Organization Details & Management Drawer */}
      <Drawer
        open={!!selected}
        title={selected?.name}
        subtitle={selected ? `Customer since ${fmtDate(selected.createdAt)}` : ''}
        onClose={() => setSelectedId(null)}
        width={680}
      >
        {selected && (
          <div>
            {/* RETENTION / SOFT DELETE NOTICE */}
            {selected.status === 'DELETED' && (
              <div
                className="callout callout--danger"
                style={{ marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Clock size={18} />
                  <strong>Scheduled for permanent deletion</strong>
                </div>
                <p style={{ margin: 0 }}>
                  This organization was soft-deleted and will be permanently purged on{' '}
                  <strong>{fmtDate(selected.scheduledPurgeAt)}</strong> (
                  <strong>{selected.daysUntilPurge ?? 30} days remaining</strong>). User logins are currently blocked.
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <Button size="sm" icon={RotateCcw} onClick={() => handleRestoreOrg(selected)}>
                    Restore organization now
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={Trash2}
                    onClick={() => setTargetPurgeOrg(selected)}
                  >
                    Purge permanently now
                  </Button>
                </div>
              </div>
            )}

            <Tabs
              value={drawerTab}
              onChange={setDrawerTab}
              tabs={[
                { value: 'overview', label: 'Overview & Settings', icon: Building2 },
                {
                  value: 'departments',
                  label: `Departments (${orgDepartments.length}/${lim(selected.maxDepartments)})`,
                  icon: Briefcase,
                },
                {
                  value: 'users',
                  label: `Users (${orgUsers.filter((u) => u.isActive).length}/${lim(selected.maxUsers)})`,
                  icon: Users,
                },
              ]}
            />

            {/* TAB 1: OVERVIEW & SETTINGS */}
            {drawerTab === 'overview' && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-4)',
                  }}
                >
                  <div>
                    {selected.status === 'DELETED' ? (
                      <StatusBadge
                        status="REJECTED"
                        label={`Scheduled for deletion (${selected.daysUntilPurge ?? 30}d left)`}
                      />
                    ) : (
                      <StatusBadge status={selected.status} />
                    )}
                  </div>
                  {selected.status !== 'DELETED' && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setShowEditOrg(true)}>
                        Edit settings
                      </Button>
                      {selected.status === 'SUSPENDED' ? (
                        <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => reactivate(selected)}>
                          Reactivate
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" icon={Ban} onClick={() => setTargetSuspend(selected)}>
                          Suspend
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        onClick={() => setTargetDeleteOrg(selected)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>

                {selected.status === 'SUSPENDED' && selected.statusReason && (
                  <div className="callout callout--danger" style={{ marginBottom: 'var(--space-4)' }}>
                    <strong>Suspended{selected.statusChangedAt ? ` on ${fmtDate(selected.statusChangedAt)}` : ''}</strong>
                    <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{selected.statusReason}</p>
                  </div>
                )}

                <h3 className="section-title">Subscription & Quota Limits</h3>
                <DetailList
                  items={[
                    ['Plan name', selected.planName ?? 'None'],
                    ['Department quota', `${orgDepartments.length} of ${lim(selected.maxDepartments)} used`],
                    ['User seat quota', `${orgUsers.filter((u) => u.isActive).length} of ${lim(selected.maxUsers)} seats used`],
                    ['Subscription status', selected.subscriptionStatus?.toLowerCase() ?? 'none'],
                    ['Billing cycle', selected.billingCycle?.toLowerCase() ?? '—'],
                    ['Renewal date', selected.renewalDate ? fmtDate(selected.renewalDate) : null],
                    ['Owner', selected.ownerName],
                    ['Owner email', selected.ownerEmail],
                    ['Last active', selected.lastActiveAt ? fmtDateTime(selected.lastActiveAt) : 'Never'],
                    ['Organization ID', <code key="id">{selected.id}</code>],
                  ]}
                />

                <h3 className="section-title">Usage metrics</h3>
                <DetailList
                  items={[
                    ['Active users', selected.userCount],
                    ['Operational departments', selected.departmentCount],
                    ['Locations mapped', selected.locationCount],
                    ['Usage records logged', selected.recordCount],
                  ]}
                />

                <h3 className="section-title">Active members by role</h3>
                {Object.keys(selected.usersByRole ?? {}).length === 0 ? (
                  <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>No active users.</p>
                ) : (
                  <DetailList
                    items={Object.entries(selected.usersByRole).map(([role, n]) => [
                      ORG_ROLE_LABELS[role] ?? role,
                      n,
                    ])}
                  />
                )}

                <h3 className="section-title">Reporting parameters</h3>
                <DetailList
                  items={[
                    ['Baseline year', selected.baselineYear],
                    ['Currency', selected.currency],
                    ['Carbon price per ton', selected.carbonPricePerTon != null ? fmtMoney(selected.carbonPricePerTon) : 'Not configured'],
                    ['Session limit override', selected.sessionTimeoutOverrideMin ? `${selected.sessionTimeoutOverrideMin} min` : 'Platform default'],
                    ['Org maintenance mode', selected.maintenanceMode ? 'Enabled' : 'Disabled'],
                  ]}
                />
              </div>
            )}

            {/* TAB 2: DEPARTMENTS */}
            {drawerTab === 'departments' && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600 }}>
                      Departments ({orgDepartments.length} / {lim(selected.maxDepartments)})
                    </h3>
                    <p className="text-muted" style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>
                      Organizational units for emissions reporting and member assignments.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    icon={Plus}
                    disabled={isDeptLimitReached}
                    onClick={() => setDeptModal({ open: true, mode: 'create', dept: null })}
                  >
                    Add department
                  </Button>
                </div>

                {isDeptLimitReached && (
                  <div className="callout callout--warning" style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <AlertTriangle size={16} />
                      <strong>Plan limit reached</strong>
                    </div>
                    <p style={{ margin: '4px 0 0' }}>
                      This organization has reached its maximum department limit of {selected.maxDepartments} under the {selected.planName} plan. Upgrade the plan to create more departments.
                    </p>
                  </div>
                )}

                {!loadingDepts && orgDepartments.length === 0 && (
                  <EmptyState
                    icon={Briefcase}
                    title="No departments yet"
                    description="Create a department to group users and emissions sources."
                    action={
                      <Button
                        size="sm"
                        icon={Plus}
                        onClick={() => setDeptModal({ open: true, mode: 'create', dept: null })}
                      >
                        Create first department
                      </Button>
                    }
                  />
                )}

                {orgDepartments.length > 0 && (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Department</th>
                          <th>Description</th>
                          <th className="num">Members</th>
                          <th style={{ width: 80 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgDepartments.map((dept) => (
                          <tr key={dept.id}>
                            <td>
                              <strong>{dept.name}</strong>
                              <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                                Created {fmtDate(dept.createdAt)}
                              </div>
                            </td>
                            <td>{dept.description || '—'}</td>
                            <td className="num">{dept.memberCount ?? 0}</td>
                            <td>
                              <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                                <Button
                                  variant="ghost-info"
                                  size="sm"
                                  onClick={() => setDeptModal({ open: true, mode: 'edit', dept })}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost-danger"
                                  size="sm"
                                  onClick={() => setTargetDeleteDept(dept)}
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
                )}
              </div>
            )}

            {/* TAB 3: USERS & STAFF */}
            {drawerTab === 'users' && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600 }}>
                      Organization Users ({orgUsers.filter((u) => u.isActive).length} / {lim(selected.maxUsers)})
                    </h3>
                    <p className="text-muted" style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>
                      Staff members, contributors, reviewers, and executives in this organization.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    icon={UserPlus}
                    disabled={isUserLimitReached}
                    onClick={() => setUserModal({ open: true, mode: 'create', user: null })}
                  >
                    Add user
                  </Button>
                </div>

                {isUserLimitReached && (
                  <div className="callout callout--warning" style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <AlertTriangle size={16} />
                      <strong>Plan user limit reached</strong>
                    </div>
                    <p style={{ margin: '4px 0 0' }}>
                      This organization has reached its limit of {selected.maxUsers} active users under the {selected.planName} plan. Upgrade the plan to invite more members.
                    </p>
                  </div>
                )}

                {!loadingUsers && orgUsers.length === 0 && (
                  <EmptyState
                    icon={Users}
                    title="No users found"
                    description="Add an administrator or contributor to this organization."
                    action={
                      <Button
                        size="sm"
                        icon={UserPlus}
                        onClick={() => setUserModal({ open: true, mode: 'create', user: null })}
                      >
                        Add first user
                      </Button>
                    }
                  />
                )}

                {orgUsers.length > 0 && (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Role</th>
                          <th>Department</th>
                          <th>Status</th>
                          <th>Last sign-in</th>
                          <th style={{ width: 80 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgUsers.map((u) => (
                          <tr key={u.id}>
                            <td>
                              <strong>{u.fullName}</strong>
                              {u.isOwner && (
                                <span
                                  className="badge badge--primary"
                                  style={{ marginLeft: 6, fontSize: '10px', padding: '2px 6px' }}
                                >
                                  Owner
                                </span>
                              )}
                              <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                                {u.email}
                              </div>
                            </td>
                            <td>{ORG_ROLE_LABELS[u.role] ?? u.role}</td>
                            <td>{u.departmentName ?? '—'}</td>
                            <td>
                              {u.isActive ? (
                                <StatusBadge status="ACTIVE" label="Active" />
                              ) : (
                                <StatusBadge status="SUSPENDED" label="Inactive" />
                              )}
                            </td>
                            <td>{u.lastLogin ? fmtDate(u.lastLogin) : 'Never'}</td>
                            <td>
                              <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                                <Button
                                  variant="ghost-info"
                                  size="sm"
                                  onClick={() => setUserModal({ open: true, mode: 'edit', user: u })}
                                >
                                  Edit
                                </Button>
                                {u.isActive && !u.isOwner && (
                                  <Button
                                    variant="ghost-danger"
                                    size="sm"
                                    onClick={() => setTargetDeactivateUser(u)}
                                  >
                                    Deactivate
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* CREATE ORGANIZATION MODAL */}
      <CreateOrgModal
        open={showCreateOrg}
        onClose={() => setShowCreateOrg(false)}
        plans={plans}
        mutation={mutations.createOrganization}
      />

      {/* EDIT ORGANIZATION MODAL */}
      {selected && (
        <EditOrgModal
          open={showEditOrg}
          onClose={() => setShowEditOrg(false)}
          org={selected}
          plans={plans}
          mutation={mutations.updateOrganization}
          activeUsersCount={orgUsers.filter((u) => u.isActive).length}
          activeDeptsCount={orgDepartments.length}
        />
      )}

      {/* CREATE / EDIT DEPARTMENT MODAL */}
      {selected && (
        <DepartmentModal
          open={deptModal.open}
          mode={deptModal.mode}
          dept={deptModal.dept}
          orgId={selected.id}
          onClose={() => setDeptModal({ open: false, mode: 'create', dept: null })}
          createMutation={mutations.createOrgDepartment}
          updateMutation={mutations.updateOrgDepartment}
        />
      )}

      {/* CREATE / EDIT USER MODAL */}
      {selected && (
        <UserModal
          open={userModal.open}
          mode={userModal.mode}
          user={userModal.user}
          orgId={selected.id}
          departments={orgDepartments}
          onClose={() => setUserModal({ open: false, mode: 'create', user: null })}
          createMutation={mutations.createOrgUser}
          updateMutation={mutations.updateOrgUser}
        />
      )}

      {/* SUSPEND ORGANIZATION CONFIRM DIALOG */}
      <ConfirmDialog
        open={!!targetSuspend}
        title={`Suspend ${targetSuspend?.name}?`}
        message={
          <>
            <p style={{ marginBottom: 'var(--space-3)' }}>
              Everyone in this organization will lose access immediately. You can reactivate it at any time.
            </p>
            <FormField
              label="Reason for suspending"
              required
              hint="Kept in the audit log and shown on the organization's detail panel."
            >
              <TextArea
                rows={3}
                maxLength={500}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Unpaid subscription after overdue notices."
              />
            </FormField>
          </>
        }
        confirmLabel="Suspend"
        danger
        confirmDisabled={!suspendReason.trim()}
        loading={mutations.setOrgStatus.isPending}
        onConfirm={() => handleStatusChange(targetSuspend, 'SUSPENDED', suspendReason.trim())}
        onCancel={() => {
          setTargetSuspend(null);
          setSuspendReason('');
        }}
      />

      {/* SOFT DELETE (30-DAY RETENTION) CONFIRM DIALOG */}
      <ConfirmDialog
        open={!!targetDeleteOrg}
        title={`Schedule ${targetDeleteOrg?.name} for deletion?`}
        message={
          <div>
            <p style={{ marginBottom: 'var(--space-3)' }}>
              <strong>{targetDeleteOrg?.name}</strong> will be soft-deleted and access will be revoked immediately for all users.
            </p>
            <div className="callout callout--warning" style={{ marginBottom: 'var(--space-2)' }}>
              <strong>30-Day Recovery Period:</strong> All records and reports are retained for 30 days. You can restore this organization at any time before the retention window ends. Afterward, it will be automatically permanently purged.
            </div>
          </div>
        }
        confirmLabel="Schedule for deletion"
        danger
        icon={Clock}
        loading={mutations.deleteOrganization.isPending}
        onConfirm={handleSoftDeleteOrg}
        onCancel={() => setTargetDeleteOrg(null)}
      />

      {/* PERMANENT PURGE CONFIRM DIALOG */}
      <ConfirmDialog
        open={!!targetPurgeOrg}
        title={`Permanently purge ${targetPurgeOrg?.name}?`}
        message={
          <div>
            <p style={{ marginBottom: 'var(--space-3)' }}>
              This will <strong>immediately and irreversibly destroy</strong> all records, departments, users, targets,
              reports, and calculation results for <strong>{targetPurgeOrg?.name}</strong>.
            </p>
            <p style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
              This cannot be undone. Data cannot be recovered.
            </p>
          </div>
        }
        confirmLabel="Permanently purge now"
        danger
        icon={ShieldAlert}
        loading={mutations.purgeOrganization.isPending}
        onConfirm={handlePurgeOrg}
        onCancel={() => setTargetPurgeOrg(null)}
      />

      {/* DELETE DEPARTMENT CONFIRM DIALOG */}
      <ConfirmDialog
        open={!!targetDeleteDept}
        title={`Delete department "${targetDeleteDept?.name}"?`}
        message="Users currently assigned to this department will become unassigned. The department will be soft-deleted to preserve historical audit logs."
        confirmLabel="Delete department"
        danger
        loading={mutations.deleteOrgDepartment.isPending}
        onConfirm={handleDeleteDepartment}
        onCancel={() => setTargetDeleteDept(null)}
      />

      {/* DEACTIVATE USER CONFIRM DIALOG */}
      <ConfirmDialog
        open={!!targetDeactivateUser}
        title={`Deactivate ${targetDeactivateUser?.fullName}?`}
        message="They will immediately lose access to this organization's workspace. Their past records and approval history will remain intact."
        confirmLabel="Deactivate user"
        danger
        loading={mutations.deactivateOrgUser.isPending}
        onConfirm={handleDeactivateUser}
        onCancel={() => setTargetDeactivateUser(null)}
      />
    </div>
  );
}

// =========================================================================
// Create Organization Modal
// =========================================================================
function CreateOrgModal({ open, onClose, plans, mutation }) {
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useZodForm(createOrgSchema, {
    name: '',
    ownerName: '',
    ownerEmail: '',
    temporaryPassword: '',
    planId: plans[0]?.id || '',
    baselineYear: '2024',
    currency: 'USD',
    carbonPricePerTon: '50',
  });

  const tempPass = watch('temporaryPassword');

  const onSubmit = async (values) => {
    try {
      const payload = {
        name: values.name.trim(),
        ownerName: values.ownerName.trim(),
        ownerEmail: values.ownerEmail.trim().toLowerCase(),
        password: values.temporaryPassword?.trim() || undefined,
        planId: values.planId || undefined,
        baselineYear: values.baselineYear ? Number(values.baselineYear) : undefined,
        currency: values.currency?.trim() || 'USD',
        carbonPricePerTon: values.carbonPricePerTon !== undefined && values.carbonPricePerTon !== ''
          ? Number(values.carbonPricePerTon)
          : undefined,
      };
      await mutation.mutateAsync(payload);
      showToast(`Organization "${payload.name}" provisioned successfully.`, 'success');
      reset();
      onClose();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not create organization.', 'error');
    }
  };

  return (
    <Drawer
      variant="modal"
      open={open}
      onClose={onClose}
      title="New Organization"
      subtitle="Provision a new tenant workspace and assign an initial owner."
      width={540}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Organization name" error={errors.name} required>
          <TextInput placeholder="e.g. Acme Industries Ltd" error={errors.name} {...register('name')} />
        </FormField>

        <div className="split-2">
          <FormField label="Owner full name" error={errors.ownerName} required>
            <TextInput placeholder="e.g. Jane Smith" error={errors.ownerName} {...register('ownerName')} />
          </FormField>
          <FormField label="Owner email" error={errors.ownerEmail} required>
            <TextInput
              type="email"
              autoComplete="off"
              placeholder="jane.smith@acme.com"
              error={errors.ownerEmail}
              {...register('ownerEmail')}
            />
          </FormField>
        </div>

        <FormField
          label="Initial password"
          error={errors.temporaryPassword}
          hint="Leave blank to default to Welcome123!"
        >
          <PasswordInput
            autoComplete="new-password"
            placeholder="Welcome123!"
            error={errors.temporaryPassword}
            {...register('temporaryPassword')}
          />
        </FormField>
        {tempPass && <PasswordRules value={tempPass} />}

        <FormField label="Subscription plan" error={errors.planId}>
          <Select {...register('planId')}>
            <option value="">No plan (assign later)</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {fmtMoney(p.priceMonthly)}/mo (Max {lim(p.maxDepartments)} depts, {lim(p.maxUsers)} users)
              </option>
            ))}
          </Select>
        </FormField>

        <div className="split-2">
          <FormField label="Baseline year" error={errors.baselineYear}>
            <TextInput type="number" min="1990" max="2050" placeholder="2024" error={errors.baselineYear} {...register('baselineYear')} />
          </FormField>
          <FormField label="Currency code" error={errors.currency}>
            <TextInput maxLength="5" placeholder="USD" error={errors.currency} {...register('currency')} />
          </FormField>
        </div>

        <FormField label="Shadow carbon price ($/tCO2e)" error={errors.carbonPricePerTon}>
          <TextInput
            type="number"
            step="0.01"
            min="0"
            placeholder="50.00"
            error={errors.carbonPricePerTon}
            {...register('carbonPricePerTon')}
          />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} icon={Plus}>
            Create organization
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

// =========================================================================
// Edit Organization Modal
// =========================================================================
function EditOrgModal({ open, onClose, org, plans, mutation, activeUsersCount, activeDeptsCount }) {
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(updateOrgSchema, {
    name: org.name,
    planId: plans.find((p) => p.name === org.planName)?.id || '',
    baselineYear: org.baselineYear ? String(org.baselineYear) : '',
    currency: org.currency || 'USD',
    carbonPricePerTon: org.carbonPricePerTon != null ? String(org.carbonPricePerTon) : '',
    sessionTimeoutOverrideMin: org.sessionTimeoutOverrideMin ? String(org.sessionTimeoutOverrideMin) : '',
    maintenanceMode: !!org.maintenanceMode,
  });

  const onSubmit = async (values) => {
    try {
      const payload = {
        name: values.name.trim(),
        planId: values.planId || undefined,
        baselineYear: values.baselineYear ? Number(values.baselineYear) : undefined,
        currency: values.currency?.trim() || undefined,
        carbonPricePerTon: values.carbonPricePerTon !== undefined && values.carbonPricePerTon !== ''
          ? Number(values.carbonPricePerTon)
          : undefined,
        sessionTimeoutOverrideMin: values.sessionTimeoutOverrideMin
          ? Number(values.sessionTimeoutOverrideMin)
          : undefined,
        maintenanceMode: values.maintenanceMode,
      };
      await mutation.mutateAsync({ id: org.id, payload });
      showToast(`Updated settings for ${org.name}.`, 'success');
      onClose();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update organization.', 'error');
    }
  };

  return (
    <Drawer
      variant="modal"
      open={open}
      onClose={onClose}
      title={`Edit ${org.name}`}
      subtitle="Update organization name, plan assignment, and reporting preferences."
      width={520}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Organization name" error={errors.name} required>
          <TextInput error={errors.name} {...register('name')} />
        </FormField>

        <FormField
          label="Subscription plan"
          error={errors.planId}
          hint={`Current usage: ${activeDeptsCount} departments, ${activeUsersCount} active users.`}
        >
          <Select {...register('planId')}>
            <option value="">Keep current plan</option>
            {plans.map((p) => {
              const exceedsDepts = p.maxDepartments < 999 && activeDeptsCount > p.maxDepartments;
              const exceedsUsers = p.maxUsers < 999 && activeUsersCount > p.maxUsers;
              const hasConflict = exceedsDepts || exceedsUsers;
              const conflictNotice = hasConflict
                ? ` [LIMIT EXCEEDED: ${exceedsUsers ? `max ${p.maxUsers} users` : ''} ${exceedsDepts ? `max ${p.maxDepartments} depts` : ''}]`
                : '';

              return (
                <option key={p.id} value={p.id} disabled={hasConflict}>
                  {p.name} — {fmtMoney(p.priceMonthly)}/mo (Max {lim(p.maxDepartments)} depts, {lim(p.maxUsers)} users){conflictNotice}
                </option>
              );
            })}
          </Select>
        </FormField>

        <div className="split-2">
          <FormField label="Baseline year" error={errors.baselineYear}>
            <TextInput type="number" min="1990" max="2050" error={errors.baselineYear} {...register('baselineYear')} />
          </FormField>
          <FormField label="Currency code" error={errors.currency}>
            <TextInput maxLength="5" error={errors.currency} {...register('currency')} />
          </FormField>
        </div>

        <div className="split-2">
          <FormField label="Carbon price ($/tCO2e)" error={errors.carbonPricePerTon}>
            <TextInput type="number" step="0.01" min="0" error={errors.carbonPricePerTon} {...register('carbonPricePerTon')} />
          </FormField>
          <FormField
            label="Session timeout override (min)"
            error={errors.sessionTimeoutOverrideMin}
            hint="5–1440 min (blank = default)"
          >
            <TextInput type="number" min="5" max="1440" error={errors.sessionTimeoutOverrideMin} {...register('sessionTimeoutOverrideMin')} />
          </FormField>
        </div>

        <div style={{ margin: 'var(--space-3) 0 var(--space-4)' }}>
          <Checkbox
            label="Enable maintenance mode for this organization"
            hint="Prevents non-admin org users from making data entry edits."
            {...register('maintenanceMode')}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} icon={Save}>
            Save changes
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

// =========================================================================
// Department Create / Edit Modal
// =========================================================================
function DepartmentModal({ open, mode, dept, orgId, onClose, createMutation, updateMutation }) {
  const isEdit = mode === 'edit';
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useZodForm(departmentSchema, {
    name: isEdit ? dept?.name : '',
    description: isEdit ? dept?.description || '' : '',
  });

  const onSubmit = async (values) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          orgId,
          deptId: dept.id,
          payload: { name: values.name.trim(), description: values.description?.trim() || null },
        });
        showToast('Department updated.', 'success');
      } else {
        await createMutation.mutateAsync({
          orgId,
          payload: { name: values.name.trim(), description: values.description?.trim() || undefined },
        });
        showToast('Department created.', 'success');
      }
      reset();
      onClose();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not save department.', 'error');
    }
  };

  return (
    <Drawer
      variant="modal"
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${dept?.name}` : 'New Department'}
      subtitle={isEdit ? 'Update department details.' : 'Add a new operational department.'}
      width={460}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Department name" error={errors.name} required>
          <TextInput placeholder="e.g. Operations, IT & Data Centers" error={errors.name} {...register('name')} />
        </FormField>

        <FormField label="Description" error={errors.description}>
          <TextArea
            rows={3}
            maxLength={500}
            placeholder="Brief description of the department's scope."
            error={errors.description}
            {...register('description')}
          />
        </FormField>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} icon={isEdit ? Save : Plus}>
            {isEdit ? 'Save department' : 'Create department'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

// =========================================================================
// User Create / Edit Modal
// =========================================================================
function UserModal({ open, mode, user, orgId, departments, onClose, createMutation, updateMutation }) {
  const isEdit = mode === 'edit';
  const { showToast } = useToast();
  const schema = isEdit ? editUserSchema : adminCreateOrgUserSchema;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useZodForm(
    schema,
    isEdit
      ? {
          fullName: user?.fullName || '',
          role: user?.role || 'CONTRIBUTOR',
          departmentId: user?.departmentId || '',
        }
      : {
          fullName: '',
          email: '',
          role: 'CONTRIBUTOR',
          departmentId: '',
          temporaryPassword: '',
        },
  );

  const tempPass = !isEdit ? watch('temporaryPassword') : '';

  const onSubmit = async (values) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          orgId,
          userId: user.id,
          payload: {
            fullName: values.fullName.trim(),
            role: values.role,
            departmentId: values.departmentId || null,
          },
        });
        showToast('User updated successfully.', 'success');
      } else {
        await createMutation.mutateAsync({
          orgId,
          payload: {
            fullName: values.fullName.trim(),
            email: values.email.trim().toLowerCase(),
            role: values.role,
            departmentId: values.departmentId || undefined,
            temporaryPassword: values.temporaryPassword?.trim() || undefined,
          },
        });
        showToast(`User ${values.fullName} added to organization.`, 'success');
      }
      reset();
      onClose();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not save user.', 'error');
    }
  };

  return (
    <Drawer
      variant="modal"
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${user?.fullName}` : 'Add Organization User'}
      subtitle={isEdit ? 'Modify user role or department.' : 'Add a user directly to this organization.'}
      width={480}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Full name" error={errors.fullName} required>
          <TextInput placeholder="Jane Doe" error={errors.fullName} {...register('fullName')} />
        </FormField>

        {!isEdit && (
          <FormField label="Email" error={errors.email} required>
            <TextInput
              type="email"
              autoComplete="off"
              placeholder="jane.doe@example.com"
              error={errors.email}
              {...register('email')}
            />
          </FormField>
        )}

        <FormField label="Role" error={errors.role} required>
          <Select error={errors.role} {...register('role')}>
            <option value="ORG_ADMIN">Organization Admin</option>
            <option value="REVIEWER">Reviewer (Data validation & targets)</option>
            <option value="CONTRIBUTOR">Contributor (Data entry)</option>
            <option value="EXECUTIVE">Executive (Reports & sign-off)</option>
          </Select>
        </FormField>

        <FormField label="Department" error={errors.departmentId}>
          <Select error={errors.departmentId} {...register('departmentId')}>
            <option value="">None (unassigned / all departments)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FormField>

        {!isEdit && (
          <>
            <FormField
              label="Initial temporary password"
              error={errors.temporaryPassword}
              hint="Leave blank to default to Welcome123!"
            >
              <PasswordInput
                autoComplete="new-password"
                placeholder="Welcome123!"
                error={errors.temporaryPassword}
                {...register('temporaryPassword')}
              />
            </FormField>
            {tempPass && <PasswordRules value={tempPass} />}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} icon={isEdit ? Save : UserPlus}>
            {isEdit ? 'Save user' : 'Add user'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
