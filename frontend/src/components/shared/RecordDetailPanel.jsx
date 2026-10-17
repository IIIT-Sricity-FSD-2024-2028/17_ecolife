import { useState } from 'react';
import { FileText, Paperclip, Calculator, Download, Trash2, Eye } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from '../ui/StatusBadge';
import { ScopeBadge } from '../ui/ScopeBadge';
import { useEvidence } from '../../hooks/useRoleData';
import { useAuth } from '../../context/AuthContext';
import { SUBMISSION_STATUS_LABELS, ROLE_BASED_STATUS_LABELS } from '../../constants/roles';
import { resourceRecordsService } from '../../services/resourceRecordsService';
import { ApiError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from './ConfirmProvider';
import { EvidenceViewerModal } from './EvidenceViewerModal';
import { fmtCo2e, fmtDate, fmtDateTime, fmtMoney, fmtNumber, fmtRange } from '../../utils/format';

/** Read-only detail of one (enriched) resource record. Shared by the
 * contributor's history drawer and the reviewer's queue drawer. */
export function RecordDetailPanel({ record }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const { data: evidence } = useEvidence(record.id);
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [viewingEvidence, setViewingEvidence] = useState(null);

  const isEditable = ['DRAFT', 'REJECTED', 'CHANGES_REQUESTED'].includes(record.status) &&
    (auth?.user?.role === 'CONTRIBUTOR' ? record.createdById === auth.user.id : true);
  const canDeleteEvidence = record.status === 'DRAFT' &&
    (auth?.user?.role === 'CONTRIBUTOR' ? record.createdById === auth.user.id : true);

  const download = async (e) => {
    try {
      await resourceRecordsService.downloadEvidence(record.id, e);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Download failed.', 'error');
    }
  };

  const deleteEvidenceFile = async (e) => {
    if (record.status !== 'DRAFT') {
      showToast('Evidence attached to submitted entries cannot be deleted.', 'error');
      return;
    }
    const ok = await confirm({
      title: `Delete “${e.fileName}”?`,
      message: 'This will remove the evidence file from this entry.',
      confirmLabel: 'Delete file',
      tone: 'danger',
      icon: Trash2,
    });
    if (!ok) return;

    try {
      await resourceRecordsService.deleteEvidence(record.id, e.id);
      qc.invalidateQueries({ queryKey: ['evidence', record.id] });
      qc.invalidateQueries({ queryKey: ['resource-records'] });
      showToast('Evidence deleted.', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to delete evidence.', 'error');
    }
  };

  const calc = record.calculation;
  const sub = record.submission;

  return (
    <div>
      <dl className="kv">
        <div><dt>Department</dt><dd>{record.departmentName}</dd></div>
        <div>
          <dt>Resource</dt>
          <dd style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>{record.resourceTypeName}</span>
            {record.category && <ScopeBadge category={record.category} />}
          </dd>
        </div>
        <div><dt>Quantity</dt><dd>{fmtNumber(record.quantity, 4)} {record.unit}</dd></div>
        <div><dt>Cost</dt><dd>{fmtMoney(record.cost)}</dd></div>
        <div><dt>Period</dt><dd>{fmtRange(record.periodStart, record.periodEnd)}</dd></div>
        <div><dt>Location</dt><dd>{record.locationName ?? '—'}</dd></div>
        {record.marketInstrument && record.marketInstrument !== 'NONE' && (
          <div><dt>Market instrument</dt><dd style={{ color: 'var(--color-primary)' }}>{record.marketInstrument}</dd></div>
        )}
        {record.deviceId && (
          <div><dt>Telemetry source</dt><dd className="text-muted">Device: {record.deviceId}</dd></div>
        )}
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
            <li key={e.id} style={{ marginBottom: 6 }}>
              {e.fileName} <span className="text-muted">({fmtNumber(e.fileSizeBytes / 1024, 0)} KB · {fmtDate(e.uploadedAt)})</span>{' '}
              {e.sha256 && (
                <span
                  title={`SHA-256 Checksum: ${e.sha256}`}
                  style={{
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    padding: '1px 5px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: 'var(--color-success)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    marginRight: 'var(--space-2)',
                  }}
                >
                  SHA-256: {e.sha256.slice(0, 8)}…
                </span>
              )}
              <button
                type="button"
                className="link-button inline-icon"
                onClick={() => setViewingEvidence(e)}
                aria-label={`Open and check ${e.fileName}`}
                style={{ marginRight: 'var(--space-2)' }}
              >
                <Eye size={14} aria-hidden="true" /> Open & Check
              </button>
              <button type="button" className="link-button inline-icon" onClick={() => download(e)} aria-label={`Download ${e.fileName}`}>
                <Download size={14} aria-hidden="true" /> Download
              </button>
              {canDeleteEvidence && (
                <button
                  type="button"
                  className="link-button inline-icon"
                  style={{ color: 'var(--color-danger, #ef4444)', marginLeft: 'var(--space-2)' }}
                  onClick={() => deleteEvidenceFile(e)}
                  aria-label={`Delete ${e.fileName}`}
                >
                  <Trash2 size={13} aria-hidden="true" /> Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No files attached.</p>
      )}

      {viewingEvidence && (
        <EvidenceViewerModal
          record={record}
          initialEvidenceId={viewingEvidence.id}
          onClose={() => setViewingEvidence(null)}
        />
      )}

      <h3 className="section-title inline-icon"><Calculator size={16} aria-hidden="true" /> Calculation</h3>
      {calc ? (
        <>
          <dl className="kv">
            <div><dt>Emissions (Total)</dt><dd>{fmtCo2e(calc.co2eKg)}</dd></div>
            {calc.co2eLocationKg != null && (
              <div><dt>Location-based</dt><dd>{fmtCo2e(calc.co2eLocationKg)}</dd></div>
            )}
            {calc.co2eMarketKg != null && (
              <div><dt>Market-based</dt><dd>{fmtCo2e(calc.co2eMarketKg)}</dd></div>
            )}
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

export function RecordStatus({ status, role }) {
  const auth = useAuth();
  const effectiveRole = role || auth?.user?.role;
  const label =
    ROLE_BASED_STATUS_LABELS[effectiveRole]?.[status] ??
    SUBMISSION_STATUS_LABELS[status] ??
    status;
  return <StatusBadge status={status} label={label} />;
}
