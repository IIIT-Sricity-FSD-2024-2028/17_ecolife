import { useState } from 'react';
import { Building, Boxes, GitCommitHorizontal, AlertTriangle, Download } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';
import { ScopeBadge } from '../ui/ScopeBadge';
import { Button } from '../ui/Button';
import { REPORT_STATUS_LABELS } from '../../constants/roles';
import { reportsService } from '../../services/reportsService';
import { useToast } from '../../context/ToastContext';
import { ApiError } from '../../services/apiClient';
import { fmtCo2e, fmtDateTime, fmtMoney, fmtNumber } from '../../utils/format';

/** Read-only body of a report: summary, breakdowns and version history. */
export function ReportContent({ report }) {
  const s = report.contentJson?.summary;
  const { showToast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const sanitized = (report.title || 'report').replace(/[^a-zA-Z0-9_-]/g, '_');
      await reportsService.exportPdf(report.id, `tropos-${sanitized}-v${report.version || 1}.pdf`);
      showToast('PDF downloaded successfully.', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to download report PDF.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <StatusBadge status={report.status} label={REPORT_STATUS_LABELS[report.status]} />
        <Button
          size="sm"
          variant="secondary"
          icon={Download}
          onClick={handleDownloadPdf}
          loading={downloading}
          title="Download official PDF report snapshot"
        >
          Export PDF
        </Button>
      </div>

      {(report.notes || report.contentJson?.notes) && (
        <div className="callout" style={{ marginBottom: 'var(--space-4)' }}>
          <strong>Reviewer notes &amp; commentary</strong>
          <p style={{ margin: 'var(--space-1) 0 0', whiteSpace: 'pre-wrap' }}>{report.notes || report.contentJson?.notes}</p>
        </div>
      )}

      {s?.entriesWithoutCalculation > 0 && (
        <div className="callout callout--warning" style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
          <AlertTriangle size={18} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Missing emission calculations</strong>
            <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>
              {s.entriesWithoutCalculation} entry(ies) in this reporting period lack an applicable emission factor and could not be calculated.
            </p>
          </div>
        </div>
      )}

      {s && (
        <dl className="kv">
          <div><dt>Total emissions</dt><dd>{fmtCo2e(s.totalCo2eKg)}</dd></div>
          {s.totalCo2eLocationKg != null && (
            <div><dt>Location-based</dt><dd>{fmtCo2e(s.totalCo2eLocationKg)}</dd></div>
          )}
          {s.totalCo2eMarketKg != null && (
            <div><dt>Market-based</dt><dd>{fmtCo2e(s.totalCo2eMarketKg)}</dd></div>
          )}
          <div><dt>Total cost</dt><dd>{fmtMoney(s.totalCost)}</dd></div>
          <div><dt>Carbon exposure</dt><dd>{fmtMoney(s.totalCarbonExposure)}</dd></div>
          <div><dt>Entries included</dt><dd>{s.entryCount}</dd></div>
          {s.entriesWithoutCalculation > 0 && (
            <div><dt>Uncalculated entries</dt><dd style={{ color: 'var(--color-warning)' }}>{s.entriesWithoutCalculation}</dd></div>
          )}
        </dl>
      )}

      {report.contentJson?.byDepartment && (
        <>
          <h3 className="section-title inline-icon"><Building size={16} aria-hidden="true" /> By department</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th className="num">Entries</th>
                <th className="num">Location (kg)</th>
                <th className="num">Market (kg)</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.contentJson.byDepartment).map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td className="num">{v.entries}</td>
                  <td className="num">{fmtNumber(v.co2eLocationKg ?? v.co2eKg, 1)}</td>
                  <td className="num">{fmtNumber(v.co2eMarketKg ?? v.co2eKg, 1)}</td>
                  <td className="num">{fmtMoney(v.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {report.contentJson?.byResourceType && (
        <>
          <h3 className="section-title inline-icon"><Boxes size={16} aria-hidden="true" /> By resource type</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Category</th>
                <th className="num">Location (kg)</th>
                <th className="num">Market (kg)</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.contentJson.byResourceType).map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td><ScopeBadge category={v.category} /></td>
                  <td className="num">{fmtNumber(v.co2eLocationKg ?? v.co2eKg, 1)}</td>
                  <td className="num">{fmtNumber(v.co2eMarketKg ?? v.co2eKg, 1)}</td>
                  <td className="num">{fmtMoney(v.cost)}</td>
                </tr>
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
