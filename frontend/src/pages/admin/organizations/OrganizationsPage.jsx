import { useState } from 'react';
import { Ban, RotateCcw, SearchX } from 'lucide-react';
import { useAdminOrganizations, useAdminMutations } from '../../../hooks/useAdminData';
import { Card, CardHeader } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { FormField, TextInput, Select, TextArea } from '../../../components/ui/FormField';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { Drawer } from '../../../components/ui/Drawer';
import { DetailList } from '../../../components/shared/DetailList';
import { rowProps } from '../../../components/shared/rowProps';
import { ORG_ROLE_LABELS } from '../../../constants/roles';
import { fmtDate, fmtDateTime, fmtMoney } from '../../../utils/format';

export function OrganizationsPage() {
  const { data: orgs = [], isLoading } = useAdminOrganizations();
  const { setOrgStatus } = useAdminMutations();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const selected = orgs.find((o) => o.id === selectedId) ?? null;

  const shown = orgs.filter((o) =>
    (!filters.status || o.status === filters.status) &&
    (!filters.q || `${o.name} ${o.ownerEmail ?? ''} ${o.ownerName ?? ''}`.toLowerCase().includes(filters.q.toLowerCase())));

  const change = async (org, status, why) => {
    try { await setOrgStatus.mutateAsync({ id: org.id, status, reason: why }); showToast(`${org.name} is now ${status.toLowerCase()}.`, 'success'); }
    catch (err) { showToast(err instanceof ApiError ? err.message : 'Something went wrong.', 'error'); }
    finally { setTarget(null); setReason(''); }
  };

  const reactivate = async (org) => {
    const ok = await confirm({
      title: `Reactivate ${org.name}?`,
      message: 'Their users will be able to sign in and use Tropos again straight away.',
      confirmLabel: 'Reactivate',
      icon: RotateCcw,
    });
    if (ok) change(org, 'ACTIVE');
  };

  return (
    <div>
      <PageHeader subtitle="Every customer organization, its plan, and how active it is." />
      <Card padded={false}>
        <div style={{ padding: 'var(--space-5)' }}>
          <CardHeader title={`${shown.length} organization${shown.length === 1 ? '' : 's'}`} subtitle="Suspending blocks that organization's users from signing in; their data is kept." />
          <div className="filters" style={{ marginBottom: 0 }}>
            <FormField label="Search"><TextInput placeholder="Name or owner" aria-label="Search organizations" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></FormField>
            <FormField label="Status">
              <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">All statuses</option><option value="ACTIVE">Active</option><option value="TRIAL">Trial</option><option value="SUSPENDED">Suspended</option>
              </Select>
            </FormField>
          </div>
        </div>
        {!isLoading && shown.length === 0 && <EmptyState icon={SearchX} title="No organizations found" />}
        {shown.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Organization</th><th>Owner</th><th>Plan</th><th className="num">Users</th><th className="num">Depts</th><th className="num">Entries</th><th>Last active</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={o.id} {...rowProps(() => setSelectedId(o.id))}>
                    <td><strong>{o.name}</strong><div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Since {fmtDate(o.createdAt)}</div></td>
                    <td>{o.ownerName ?? '—'}<div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{o.ownerEmail}</div></td>
                    <td>{o.planName ?? '—'}{o.subscriptionStatus && <div className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>{o.subscriptionStatus.toLowerCase()}</div>}</td>
                    <td className="num">{o.userCount}</td>
                    <td className="num">{o.departmentCount}</td>
                    <td className="num">{o.recordCount}</td>
                    <td>{fmtDate(o.lastActiveAt)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>
                      {o.status === 'SUSPENDED'
                        ? <Button variant="ghost" size="sm" icon={RotateCcw} onClick={(e) => { e.stopPropagation(); reactivate(o); }}>Reactivate</Button>
                        : <Button variant="ghost" size="sm" icon={Ban} onClick={(e) => { e.stopPropagation(); setTarget(o); }}>Suspend</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Drawer
        open={!!selected}
        title={selected?.name}
        subtitle={selected ? `Customer since ${fmtDate(selected.createdAt)}` : ''}
        onClose={() => setSelectedId(null)}
        footer={selected && (selected.status === 'SUSPENDED'
          ? <Button icon={RotateCcw} onClick={() => reactivate(selected)}>Reactivate organization</Button>
          : <Button variant="danger" icon={Ban} onClick={() => setTarget(selected)}>Suspend organization</Button>)}
      >
        {selected && (
          <>
            <p style={{ marginBottom: 'var(--space-4)' }}><StatusBadge status={selected.status} /></p>
            {selected.status === 'SUSPENDED' && selected.statusReason && (
              <div className="callout callout--danger">
                <strong>Suspended{selected.statusChangedAt ? ` on ${fmtDate(selected.statusChangedAt)}` : ''}</strong>
                <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{selected.statusReason}</p>
              </div>
            )}
            <DetailList items={[
              ['Owner', selected.ownerName],
              ['Owner email', selected.ownerEmail],
              ['Plan', selected.planName],
              ['Subscription', selected.subscriptionStatus?.toLowerCase()],
              ['Billing cycle', selected.billingCycle?.toLowerCase()],
              ['Renews', selected.renewalDate ? fmtDate(selected.renewalDate) : null],
              ['Last active', selected.lastActiveAt ? fmtDateTime(selected.lastActiveAt) : null],
              ['Organization ID', <code key="id">{selected.id}</code>],
            ]} />
            <h3 className="section-title">Usage</h3>
            <DetailList items={[
              ['Active users', selected.userCount],
              ['Departments', selected.departmentCount],
              ['Locations', selected.locationCount],
              ['Usage entries', selected.recordCount],
            ]} />
            <h3 className="section-title">People by role</h3>
            {Object.keys(selected.usersByRole ?? {}).length === 0
              ? <p className="text-muted">No active users.</p>
              : <DetailList items={Object.entries(selected.usersByRole).map(([role, n]) => [ORG_ROLE_LABELS[role] ?? role, n])} />}
            <h3 className="section-title">Reporting settings</h3>
            <DetailList items={[
              ['Baseline year', selected.baselineYear],
              ['Currency', selected.currency],
              ['Carbon price per ton', selected.carbonPricePerTon != null ? fmtMoney(selected.carbonPricePerTon) : null],
              ['Session limit override', selected.sessionTimeoutOverrideMin ? `${selected.sessionTimeoutOverrideMin} min` : 'Platform default'],
              ['Org maintenance mode', selected.maintenanceMode ? 'On' : 'Off'],
            ]} />
          </>
        )}
      </Drawer>
      <ConfirmDialog
        open={!!target}
        title={`Suspend ${target?.name}?`}
        message={(
          <>
            <p style={{ marginBottom: 'var(--space-3)' }}>Everyone in this organization will lose access immediately. You can reactivate it at any time.</p>
            <FormField label="Reason for suspending" required hint="Kept in the audit log and shown on the organization's detail panel.">
              <TextArea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Unpaid invoice after two reminders." />
            </FormField>
          </>
        )}
        confirmLabel="Suspend"
        danger
        confirmDisabled={!reason.trim()}
        loading={setOrgStatus.isPending}
        onConfirm={() => change(target, 'SUSPENDED', reason.trim())}
        onCancel={() => { setTarget(null); setReason(''); }}
      />
    </div>
  );
}