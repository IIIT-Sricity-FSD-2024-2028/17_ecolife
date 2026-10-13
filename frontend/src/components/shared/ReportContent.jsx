import { Building, Boxes, GitCommitHorizontal } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';
import { REPORT_STATUS_LABELS } from '../../constants/roles';
import { fmtCo2e, fmtDateTime, fmtMoney, fmtNumber } from '../../utils/format';

/** Read-only body of a report: summary, breakdowns and version history. */
export function ReportContent({ report }) {
  const s = report.contentJson?.summary;
  return (
    <div>
      <p style={{ marginBottom: 'var(--space-4)' }}>
        <StatusBadge status={report.status} label={REPORT_STATUS_LABELS[report.status]} />
      </p>

      {s && (
        <dl className="kv">
          <div><dt>Total emissions</dt><dd>{fmtCo2e(s.totalCo2eKg)}</dd></div>
          <div><dt>Total cost</dt><dd>{fmtMoney(s.totalCost)}</dd></div>
          <div><dt>Carbon exposure</dt><dd>{fmtMoney(s.totalCarbonExposure)}</dd></div>
          <div><dt>Entries included</dt><dd>{s.entryCount}</dd></div>
        </dl>
      )}

      {report.contentJson?.byDepartment && (
        <>
          <h3 className="section-title inline-icon"><Building size={16} aria-hidden="true" /> By department</h3>
          <table className="data-table">
            <thead><tr><th>Department</th><th className="num">Entries</th><th className="num">Emissions (kg)</th><th className="num">Cost</th></tr></thead>
            <tbody>
              {Object.entries(report.contentJson.byDepartment).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td className="num">{v.entries}</td><td className="num">{fmtNumber(v.co2eKg, 1)}</td><td className="num">{fmtMoney(v.cost)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {report.contentJson?.byResourceType && (
        <>
          <h3 className="section-title inline-icon"><Boxes size={16} aria-hidden="true" /> By resource type</h3>
          <table className="data-table">
            <thead><tr><th>Resource</th><th>Category</th><th className="num">Emissions (kg)</th><th className="num">Cost</th></tr></thead>
            <tbody>
              {Object.entries(report.contentJson.byResourceType).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td>{v.category}</td><td className="num">{fmtNumber(v.co2eKg, 1)}</td><td className="num">{fmtMoney(v.cost)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {report.history?.length > 1 && (
        <>
          <h3 className="section-title inline-icon"><GitCommitHorizontal size={16} aria-hidden="true" /> Version history</h3>
          {report.history.map((h) => (
            <p key={h.id} style={{ margin: '4px 0', fontSize: 'var(--font-size-sm)' }}>
              <strong>v{h.version}</strong> <StatusBadge status={h.status} label={REPORT_STATUS_LABELS[h.status]} /> · {fmtDateTime(h.updatedAt)}
              {h.approvalComment && <span className="text-muted"> — “{h.approvalComment}”</span>}
            </p>
          ))}
        </>
      )}
      <p className="text-muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-5)' }}>Prepared by {report.createdByName ?? '—'}.</p>
    </div>
  );
}
