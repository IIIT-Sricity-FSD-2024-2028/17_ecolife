import { Link } from 'react-router-dom';
import { Building, Users, BellRing, CreditCard, AlertTriangle, UsersRound, Activity, ArrowRight } from 'lucide-react';
import { useDepartments, useOrgUsers, useAlerts, useSubscription } from '../../../hooks/useOrgData';
import { useResourceTypes } from '../../../hooks/useResourceRecords';
import { useAuditLogs } from '../../../hooks/useRoleData';
import { Card, CardHeader } from '../../../components/ui/Card';
import { SummaryCard } from '../../../components/ui/SummaryCard';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ORG_ROLE_LABELS } from '../../../constants/roles';
import { ORG_ADMIN_ROUTES } from '../../../constants/routes';
import { fmtDateTime } from '../../../utils/format';
import { describeAction } from '../../../utils/auditLabels';

export function OrgAdminDashboardPage() {
  const { data: departments = [] } = useDepartments();
  const { data: users = [] } = useOrgUsers();
  const { data: alerts = [] } = useAlerts();
  const { data: sub } = useSubscription();
  const { data: types = [] } = useResourceTypes();
  const { data: audit } = useAuditLogs({ limit: 6 });

  const active = users.filter((u) => u.isActive);
  const openAlerts = alerts.filter((a) => a.status === 'OPEN');
  const byRole = Object.keys(ORG_ROLE_LABELS).map((r) => ({ role: r, count: active.filter((u) => u.role === r).length }));
  const unassigned = departments.filter((d) => !active.some((u) => u.departmentId === d.id));

  return (
    <div>
      <PageHeader subtitle="People, activity, and plan status for your organization." />
      <div className="summary-grid">
        <SummaryCard icon={Building} label="Departments" value={departments.length} />
        <SummaryCard icon={Users} label="Active staff" value={active.length} />
        <SummaryCard icon={BellRing} label="Open alerts" value={openAlerts.length} />
        <SummaryCard icon={CreditCard} label="Plan" value={sub?.plan?.name ?? '—'} />
      </div>

      <div className="stack">
        {(unassigned.length > 0 || openAlerts.length > 0 || sub?.status === 'TRIAL') && (
          <Card>
            <CardHeader icon={AlertTriangle} title="Needs attention" />
            <ul style={{ paddingLeft: 'var(--space-5)' }}>
              {unassigned.map((d) => (
                <li key={d.id}><Link to={ORG_ADMIN_ROUTES.PEOPLE}>{d.name} has no active contributor assigned</Link></li>
              ))}
              {openAlerts.length > 0 && <li><Link to={ORG_ADMIN_ROUTES.ALERTS}>{openAlerts.length} open alert{openAlerts.length > 1 ? 's' : ''} awaiting a response</Link></li>}
              {sub?.status === 'TRIAL' && <li><Link to={ORG_ADMIN_ROUTES.BILLING}>Your subscription is a trial — choose a plan</Link></li>}
            </ul>
          </Card>
        )}

        <div className="split-2">
          <Card>
            <CardHeader icon={UsersRound} title="People by role" actions={<Link to={ORG_ADMIN_ROUTES.PEOPLE} className="inline-icon">Manage <ArrowRight size={14} aria-hidden="true" /></Link>} />
            {byRole.map((r) => (
              <div key={r.role} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                <span>{ORG_ROLE_LABELS[r.role]}</span><strong>{r.count}</strong>
              </div>
            ))}
            <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-3)' }}>{types.length} resource types available to your organization.</p>
          </Card>

          <Card>
            <CardHeader icon={Activity} title="Recent activity" actions={<Link to={ORG_ADMIN_ROUTES.AUDIT_LOG} className="inline-icon">Audit log <ArrowRight size={14} aria-hidden="true" /></Link>} />
            {audit?.items.length === 0 && <p className="text-muted">No activity yet.</p>}
            {audit?.items.map((l) => (
              <div key={l.id} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}>
                <strong>{l.actorName}</strong> {describeAction(l.action).toLowerCase()}
                <div className="text-muted">{fmtDateTime(l.createdAt)}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
