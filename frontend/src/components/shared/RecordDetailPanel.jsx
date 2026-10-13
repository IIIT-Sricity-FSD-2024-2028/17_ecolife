import { FileText, Paperclip, Calculator } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';
import { useEvidence } from '../../hooks/useRoleData';
import { SUBMISSION_STATUS_LABELS } from '../../constants/roles';
import { fmtCo2e, fmtDate, fmtDateTime, fmtMoney, fmtNumber, fmtRange } from '../../utils/format';

/** Read-only detail of one (enriched) resource record. Shared by the
 * contributor's history drawer and the reviewer's queue drawer. */
export function RecordDetailPanel({ record }) {
  const { data: evidence } = useEvidence(record.id);
  const calc = record.calculation;
  const sub = record.submission;

  return (
    <div>
      <dl className="kv">
        <div><dt>Department</dt><dd>{record.departmentName}</dd></div>
        <div><dt>Resource</dt><dd>{record.resourceTypeName}</dd></div>
        <div><dt>Quantity</dt><dd>{fmtNumber(record.quantity, 4)} {record.unit}</dd></div>
        <div><dt>Cost</dt><dd>{fmtMoney(record.cost)}</dd></div>
        <div><dt>Period</dt><dd>{fmtRange(record.periodStart, record.periodEnd)}</dd></div>
        <div><dt>Location</dt><dd>{record.locationName ?? '—'}</dd></div>
        <div><dt>Entered by</dt><dd>{record.createdByName ?? '—'}</dd></div>
        <div><dt>Submitted</dt><dd>{fmtDateTime(record.submittedAt)}</dd></div>
      </dl>

      {record.notes && (
        <>
          <h3 className="section-title inline-icon"><FileText size={16} aria-hidden="true" /> Notes</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{record.notes}</p>
        </>
      )}

      {sub?.reviewComment && (
        <div className={`callout ${record.status === 'APPROVED' || record.status === 'LOCKED' ? 'callout--success' : 'callout--warning'}`}>
          <strong>
            {SUBMISSION_STATUS_LABELS[sub.status] ?? sub.status}
            {sub.reviewedByName ? ` by ${sub.reviewedByName}` : ''} · {fmtDate(sub.reviewedAt)}
          </strong>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{sub.reviewComment}</p>
        </div>
      )}

      <h3 className="section-title inline-icon"><Paperclip size={16} aria-hidden="true" /> Evidence</h3>
      {record.evidenceRequirement === 'REQUIRED' && (
        <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
          Required: this entry is above the {fmtNumber(record.evidenceThreshold)} {record.unit} threshold.
        </p>
      )}
      {evidence?.length ? (
        <ul style={{ paddingLeft: 'var(--space-5)' }}>
          {evidence.map((e) => (
            <li key={e.id}>
              {e.fileName} <span className="text-muted">({fmtNumber(e.fileSizeBytes / 1024, 0)} KB · {fmtDate(e.uploadedAt)})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No files attached.</p>
      )}

      <h3 className="section-title inline-icon"><Calculator size={16} aria-hidden="true" /> Calculation</h3>
      {calc ? (
        <>
          <dl className="kv">
            <div><dt>Emissions</dt><dd>{fmtCo2e(calc.co2eKg)}</dd></div>
            <div><dt>Carbon exposure</dt><dd>{fmtMoney(calc.carbonExposure)}</dd></div>
            <div><dt>Vs. usage target</dt><dd>{calc.savingsVsBaseline == null ? 'No target set' : `${fmtNumber(calc.savingsVsBaseline)} ${record.unit} under`}</dd></div>
            <div><dt>Calculated</dt><dd>{fmtDateTime(calc.calculatedAt)}{calc.recalculatedCount ? ` · recalculated ${calc.recalculatedCount}×` : ''}</dd></div>
          </dl>
          <div className="lineage">
            <p style={{ margin: '0 0 var(--space-2)' }}>
              <strong>How this was derived</strong> ({calc.factorScope === 'ORG_OVERRIDE' ? 'organization override factor' : 'global default factor'})
            </p>
            {calc.factors.map((f) => (
              <p key={f.id} style={{ margin: '2px 0' }}>
                <code>{fmtNumber(record.quantity, 4)} {record.unit} × {f.factorValue} {f.unit} × GWP {f.gwp} ({f.gas})</code> = {fmtCo2e(f.contributionKg)}
                <br />
                <span className="text-muted">Source: {f.sourceName} · effective {fmtDate(f.effectiveFrom)}</span>
              </p>
            ))}
          </div>
        </>
      ) : (
        <p className="text-muted">Emissions are calculated automatically when the entry is approved.</p>
      )}
    </div>
  );
}

export function RecordStatus({ status }) {
  return <StatusBadge status={status} label={SUBMISSION_STATUS_LABELS[status]} />;
}
