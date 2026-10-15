import { Link } from 'react-router-dom';
import { ClipboardCheck, CheckCircle2, Leaf, BellRing, AlertTriangle, Building, ArrowRight } from 'lucide-react';
import { useEmissions } from '../../../hooks/useRoleData';
import { useResourceRecords } from '../../../hooks/useResourceRecords';
import { useAlerts, useReports } from '../../../hooks/useOrgData';
import { useAmendments } from '../../../hooks/useRoleData';
import { Card, CardHeader } from '../../../components/ui/Card';
import { SummaryCard } from '../../../components/ui/SummaryCard';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ProgressBar } from '../../../components/ui/charts';
import { REVIEWER_ROUTES } from '../../../constants/routes';
import { fmtCo2e, fmtDate, fmtNumber } from '../../../utils/format';

export function ReviewerDashboardPage() {
  const { data: emissions } = useEmissions({});
  const { data: records = [] } = useResourceRecords();
  const { data: alerts = [] } = useAlerts();
  const { data: reports = [] } = useReports();
  const { data: amendments = [] } = useAmendments();

  const queue = records.filter((r) => r.status === 'SUBMITTED').sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''));
  const openAlerts = alerts.filter((a) => a.status === 'OPEN');
  const revisions = reports.filter((r) => r.status === 'REVISION_REQUESTED');
  const pendingAmendments = amendments.filter((a) => a.status === 'PENDING_APPROVAL');

  const attention = [
    queue.length > 0 && { text: `${queue.length} submission${queue.length > 1 ? 's' : ''} awaiting review (oldest ${fmtDate(queue[0].submittedAt)})`, to: REVIEWER_ROUTES.SUBMISSIONS },
    openAlerts.length > 0 && { text: `${openAlerts.length} open alert${openAlerts.length > 1 ? 's' : ''}`, to: REVIEWER_ROUTES.ALERTS },
    revisions.length > 0 && { text: `${revisions.length} report${revisions.length > 1 ? 's' : ''} sent back for revision`, to: REVIEWER_ROUTES.REPORTS },
    pendingAmendments.length > 0 && { text: `${pendingAmendments.length} amendment${pendingAmendments.length > 1 ? 's' : ''} waiting on Executive approval`, to: REVIEWER_ROUTES.AMENDMENTS },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader subtitle="Approved data across all departments, and what needs your attention." />
      <div className="summary-grid">
        <SummaryCard icon={ClipboardCheck} label="Awaiting review" value={queue.length} />
        <SummaryCard icon={CheckCircle2} label="Approved entries" value={emissions?.totals.entries ?? '—'} />
        <SummaryCard icon={Leaf} label="Total emissions" value={emissions ? fmtCo2e(emissions.totals.co2eKg) : '—'} />
        <SummaryCard icon={BellRing} label="Open alerts" value={openAlerts.length} />
      </div>

      <div className="stack">
        <Card>
          <CardHeader icon={AlertTriangle} title="Needs attention" />
          {attention.length === 0 ? (
            <p className="text-muted">You’re all caught up.</p>
          ) : (
            <ul style={{ paddingLeft: 'var(--space-5)' }}>
              {attention.map((a) => <li key={a.to} style={{ marginBottom: 'var(--space-2)' }}><Link to={a.to}>{a.text}</Link></li>)}
            </ul>
          )}
        </Card>

        <Card padded={false}>
          <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}>
            <CardHeader icon={Building} title="Department performance" subtitle="Approved data only" actions={<Link to={REVIEWER_ROUTES.EMISSIONS} className="inline-icon">Full analysis <ArrowRight size={14} aria-hidden="true" /></Link>} />
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Department</th><th className="num">Approved entries</th><th className="num">Emissions</th><th className="num">Pending review</th><th>Against targets</th></tr></thead>
              <tbody>
                {emissions?.departments.map((d) => {
                  const worst = d.targets.reduce((m, t) => (t.percentOfTarget != null && t.percentOfTarget > (m ?? -1) ? t.percentOfTarget : m), null);
                  return (
                    <tr key={d.departmentId}>
                      <td>{d.name}</td>
                      <td className="num">{d.entries}</td>
                      <td className="num">{fmtNumber(d.co2eKg, 1)} kg</td>
                      <td className="num">{records.filter((r) => r.departmentId === d.departmentId && r.status === 'SUBMITTED').length}</td>
                      <td>{d.targets.length ? <ProgressBar percent={worst} /> : <span className="text-muted">No targets</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
