import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, BellRing, Building2, ClipboardList, HeartPulse, Layers, ArrowRight, Users } from 'lucide-react';
import { useAdminOverview, useAdminAuditLogs } from '../../../hooks/useAdminData';
import { Card, CardHeader } from '../../../components/ui/Card';
import { SummaryCard } from '../../../components/ui/SummaryCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ADMIN_ROUTES } from '../../../constants/routes';
import { describeAction } from '../../../utils/auditLabels';
import { fmtDateTime, fmtNumber } from '../../../utils/format';

const fmtUptime = (s) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};
const Row = ({ label, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
    <span className="text-muted">{label}</span><strong>{children}</strong>
  </div>
);

export function AdminDashboardPage() {
  const { data: o, isLoading } = useAdminOverview();
  const { data: audit } = useAdminAuditLogs({ limit: 6 });
  if (isLoading || !o) return <p className="text-muted">Loading…</p>;

  const warnings = [
    o.system.maintenanceMode && { text: 'Maintenance mode is ON — organization users are blocked.', to: ADMIN_ROUTES.SETTINGS },
    o.factors.typesWithoutFactor.length > 0 && { text: `No global emission factor for: ${o.factors.typesWithoutFactor.join(', ')}`, to: ADMIN_ROUTES.RESOURCES },
    (o.organizations.byStatus.SUSPENDED ?? 0) > 0 && { text: `${o.organizations.byStatus.SUSPENDED} suspended organization(s)`, to: ADMIN_ROUTES.ORGANIZATIONS },
    (o.subscriptions.byStatus.PAST_DUE ?? 0) > 0 && { text: `${o.subscriptions.byStatus.PAST_DUE} subscription(s) past due`, to: ADMIN_ROUTES.REVENUE },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader subtitle="Organizations, people, emission factors and system health across the platform." />
      <div className="summary-grid">
        <SummaryCard icon={Building2} label="Organizations" value={o.organizations.total} />
        <SummaryCard icon={Users} label="Active org users" value={o.people.activeOrgUsers} />
        <SummaryCard icon={ClipboardList} label="Usage entries" value={o.activity.resourceRecords} />
        <SummaryCard icon={BellRing} label="Open alerts" value={o.activity.openAlerts} />
      </div>

      <div className="stack">
        <Card>
          <CardHeader icon={AlertTriangle} title="Needs attention" />
          {warnings.length === 0 ? <p className="text-muted">Everything looks healthy.</p> : (
            <ul style={{ paddingLeft: 'var(--space-5)' }}>{warnings.map((w) => <li key={w.text}><Link to={w.to}>{w.text}</Link></li>)}</ul>
          )}
        </Card>

        <div className="split-2">
          <Card>
            <CardHeader icon={Building2} title="Organizations" actions={<Link to={ADMIN_ROUTES.ORGANIZATIONS} className="inline-icon">Manage <ArrowRight size={14} aria-hidden="true" /></Link>} />
            {Object.entries(o.organizations.byStatus).map(([k, v]) => <Row key={k} label={k.charAt(0) + k.slice(1).toLowerCase()}>{v}</Row>)}
            <h3 className="section-title">Subscribers by plan</h3>
            {o.subscriptions.byPlan.map((p) => <Row key={p.planId} label={p.name}>{p.subscribers}</Row>)}
          </Card>

          <Card>
            <CardHeader icon={Layers} title="Emission factors" actions={<Link to={ADMIN_ROUTES.RESOURCES} className="inline-icon">Govern <ArrowRight size={14} aria-hidden="true" /></Link>} />
            <Row label="Resource types">{o.factors.resourceTypes}</Row>
            <Row label="Factor sources">{o.factors.sources}</Row>
            <Row label="Global factor versions">{o.factors.globalVersions}</Row>
            <Row label="Organization overrides">{o.factors.orgOverrides}</Row>
            <Row label="Locked (used in calculations)">{o.factors.lockedVersions}</Row>
          </Card>
        </div>

        <div className="split-2">
          <Card>
            <CardHeader icon={HeartPulse} title="System health" />
            <Row label="Maintenance mode"><StatusBadge status={o.system.maintenanceMode ? 'SUSPENDED' : 'ACTIVE'} label={o.system.maintenanceMode ? 'On' : 'Off'} /></Row>
            <Row label="API uptime">{fmtUptime(o.system.uptimeSeconds)}</Row>
            <Row label="Node.js">{o.system.nodeVersion}</Row>
            <Row label="Data file">{o.system.dataFileBytes == null ? 'Not written yet' : `${fmtNumber(o.system.dataFileBytes / 1024, 0)} KB`}</Row>
            <Row label="Audit log entries">{o.system.auditLogEntries}</Row>
            <Row label="New entries (30 days)">{o.activity.newRecordsLast30Days}</Row>
          </Card>

          <Card>
            <CardHeader icon={Activity} title="Recent activity" actions={<Link to={ADMIN_ROUTES.AUDIT_LOG} className="inline-icon">Audit log <ArrowRight size={14} aria-hidden="true" /></Link>} />
            {audit?.items.map((l) => (
              <div key={l.id} style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--font-size-sm)' }}>
                <strong>{l.actorName}</strong> {describeAction(l.action).toLowerCase()}{l.organizationName ? <span className="text-muted"> · {l.organizationName}</span> : ''}
                <div className="text-muted">{fmtDateTime(l.createdAt)}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}