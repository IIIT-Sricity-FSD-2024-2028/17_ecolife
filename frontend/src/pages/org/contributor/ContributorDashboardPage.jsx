import { Link } from 'react-router-dom';
import { FilePlus2, AlertTriangle, Hourglass, CheckCircle2, BellRing, History, ArrowRight, FileX2 } from 'lucide-react';
import { useProfile } from '../../../hooks/useRoleData';
import { useResourceRecords } from '../../../hooks/useResourceRecords';
import { useAlerts } from '../../../hooks/useOrgData';
import { Card, CardHeader } from '../../../components/ui/Card';
import { SummaryCard } from '../../../components/ui/SummaryCard';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { EmptyState } from '../../../components/shared/EmptyState';
import { RecordStatus } from '../../../components/shared/RecordDetailPanel';
import { CONTRIBUTOR_ROUTES } from '../../../constants/routes';
import { fmtDate, fmtNumber, fmtRange } from '../../../utils/format';
import { PageHeader } from '../../../components/ui/PageHeader';

const NEEDS_ACTION = ['DRAFT', 'REJECTED', 'CHANGES_REQUESTED'];

export function ContributorDashboardPage() {
  const { data: profile } = useProfile();
  const { data: records = [] } = useResourceRecords();
  const { data: alerts = [] } = useAlerts();

  const needsAction = records.filter((r) => NEEDS_ACTION.includes(r.status));
  const inReview = records.filter((r) => r.status === 'SUBMITTED');
  const approved = records.filter((r) => ['APPROVED', 'LOCKED'].includes(r.status));
  const openAlerts = alerts.filter((a) => a.status === 'OPEN');
  const recent = records.slice(0, 6);

  return (
    <div>
      <PageHeader
        subtitle={`Welcome back${profile ? `, ${profile.fullName.split(' ')[0]}` : ''}. ${profile?.departmentName ? `You submit data for ${profile.departmentName}.` : 'Your account is not assigned to a department yet — contact your Org Admin.'}`}
        actions={<Link to={CONTRIBUTOR_ROUTES.SUBMIT}><Button icon={FilePlus2}>New submission</Button></Link>}
      />

      <div className="summary-grid">
        <SummaryCard icon={AlertTriangle} label="Need your action" value={needsAction.length} />
        <SummaryCard icon={Hourglass} label="In review" value={inReview.length} />
        <SummaryCard icon={CheckCircle2} label="Approved entries" value={approved.length} />
        <SummaryCard icon={BellRing} label="Open alerts" value={openAlerts.length} />
      </div>

      <div className="stack">
        <Card padded={false}>
          <div style={{ padding: 'var(--space-5) var(--space-5) 0' }}>
            <CardHeader icon={History} title="Recent submissions" actions={<Link to={CONTRIBUTOR_ROUTES.HISTORY} className="inline-icon">View all <ArrowRight size={14} aria-hidden="true" /></Link>} />
          </div>
          {recent.length === 0 ? (
            <EmptyState icon={FileX2} title="No submissions yet" description="Log your first usage entry to get started." />
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Period</th><th>Resource</th><th className="num">Consumption</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtRange(r.periodStart, r.periodEnd)}</td>
                      <td>{r.resourceTypeName}</td>
                      <td className="num">{fmtNumber(r.quantity, 2)} {r.unit}</td>
                      <td><RecordStatus status={r.status} /></td>
                      <td>
                        <Link to={`${CONTRIBUTOR_ROUTES.HISTORY}?record=${r.id}`}>
                          {NEEDS_ACTION.includes(r.status) ? 'Continue' : 'View'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader icon={BellRing} title="Active alerts" actions={<Link to={CONTRIBUTOR_ROUTES.ALERTS} className="inline-icon">Respond <ArrowRight size={14} aria-hidden="true" /></Link>} />
          {openAlerts.length === 0 ? (
            <p className="text-muted">Nothing needs your attention right now.</p>
          ) : (
            openAlerts.slice(0, 5).map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                <span>{a.message}</span>
                <span className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                  <StatusBadge status={a.severity === 'CRITICAL' ? 'REJECTED' : 'CHANGES_REQUESTED'} label={a.severity === 'CRITICAL' ? 'Critical' : 'Warning'} /> {fmtDate(a.createdAt)}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
