import { Link } from 'react-router-dom';
import { Leaf, Wallet, FileCheck2, FilePenLine, AlertTriangle, TrendingUp, Building } from 'lucide-react';
import { useEmissions, useAmendments } from '../../../hooks/useRoleData';
import { useReports, useAlerts } from '../../../hooks/useOrgData';
import { Card, CardHeader } from '../../../components/ui/Card';
import { SummaryCard } from '../../../components/ui/SummaryCard';
import { PageHeader } from '../../../components/ui/PageHeader';
import { BarChart, ProgressBar } from '../../../components/ui/charts';
import { EXECUTIVE_ROUTES } from '../../../constants/routes';
import { fmtCo2e, fmtMoney, fmtMonth, fmtNumber } from '../../../utils/format';

export function ExecutiveDashboardPage() {
  const { data: emissions } = useEmissions({});
  const { data: reports = [] } = useReports();
  const { data: amendments = [] } = useAmendments();
  const { data: alerts = [] } = useAlerts();

  const pendingReports = reports.filter((r) => r.status === 'PENDING_APPROVAL');
  const pendingAmendments = amendments.filter((a) => a.status === 'PENDING_APPROVAL');
  const critical = alerts.filter((a) => a.status === 'OPEN' && a.severity === 'CRITICAL');
  const overTarget = [
    ...(emissions?.departments ?? []).flatMap((d) => d.targets.filter((t) => t.percentOfTarget > 100).map((t) => ({ name: d.name, t }))),
    ...(emissions?.orgTargets ?? []).filter((t) => t.percentOfTarget > 100).map((t) => ({ name: 'The organization', t })),
  ];

  const attention = [
    pendingReports.length > 0 && { text: `${pendingReports.length} report${pendingReports.length > 1 ? 's' : ''} waiting for your approval`, to: EXECUTIVE_ROUTES.REPORTS },
    pendingAmendments.length > 0 && { text: `${pendingAmendments.length} amendment${pendingAmendments.length > 1 ? 's' : ''} waiting for your decision`, to: EXECUTIVE_ROUTES.AMENDMENTS },
    ...overTarget.map(({ name, t }) => ({ text: `${name} is at ${fmtNumber(t.percentOfTarget, 0)}% of its ${t.resourceCategory ?? 'overall'} ${t.metric} target`, to: null })),
    critical.length > 0 && { text: `${critical.length} critical alert${critical.length > 1 ? 's' : ''} open`, to: null },
  ].filter(Boolean);

  return (
    <div>
      <PageHeader subtitle="Approved emissions, department performance, and the decisions waiting on you." />
      <div className="summary-grid">
        <SummaryCard icon={Leaf} label="Total emissions (approved)" value={emissions ? fmtCo2e(emissions.totals.co2eKg) : '—'} />
        <SummaryCard icon={Wallet} label="Total cost" value={emissions ? fmtMoney(emissions.totals.cost) : '—'} />
        <SummaryCard icon={FileCheck2} label="Reports to approve" value={pendingReports.length} />
        <SummaryCard icon={FilePenLine} label="Amendments to decide" value={pendingAmendments.length} />
      </div>

      <div className="stack">
        <Card>
          <CardHeader icon={AlertTriangle} title="Attention required" />
          {attention.length === 0 ? <p className="text-muted">Nothing needs your decision right now.</p> : (
            <ul style={{ paddingLeft: 'var(--space-5)' }}>
              {attention.map((a, i) => <li key={i} style={{ marginBottom: 'var(--space-2)' }}>{a.to ? <Link to={a.to}>{a.text}</Link> : a.text}</li>)}
            </ul>
          )}
        </Card>

        {emissions?.trend.length > 0 && (
          <Card>
            <CardHeader icon={TrendingUp} title="Emissions trend" subtitle="kg CO₂e by month, approved data" />
            <BarChart data={emissions.trend.map((t) => ({ label: fmtMonth(t.month), value: t.co2eKg }))} format={(v) => `${fmtNumber(v, 1)} kg`} />
          </Card>
        )}

        <Card padded={false}>
          <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}><CardHeader icon={Building} title="Department performance" /></div>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Department</th><th className="num">Emissions</th><th className="num">Cost</th><th>Closest target</th></tr></thead>
              <tbody>
                {emissions?.departments.map((d) => {
                  const worst = d.targets.reduce((m, t) => (t.percentOfTarget != null && (m == null || t.percentOfTarget > m) ? t.percentOfTarget : m), null);
                  return (
                    <tr key={d.departmentId}>
                      <td>{d.name}</td>
                      <td className="num">{fmtCo2e(d.co2eKg)}</td>
                      <td className="num">{fmtMoney(d.cost)}</td>
                      <td>{worst == null ? <span className="text-muted">No targets</span> : <ProgressBar percent={worst} />}</td>
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
