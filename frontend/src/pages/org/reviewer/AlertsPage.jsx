import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellOff, ExternalLink, Check, CheckCircle2, X } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { EmptyState } from '../../../components/shared/EmptyState';
import { Button } from '../../../components/ui/Button';
import { useAlerts, useAcknowledgeAlert, useCloseAlert } from '../../../hooks/useOrgData';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { REVIEWER_ROUTES } from '../../../constants/routes';
import { Drawer } from '../../../components/ui/Drawer';
import { DetailList } from '../../../components/shared/DetailList';
import { rowProps } from '../../../components/shared/rowProps';
import { fmtCo2e, fmtDate, fmtDateTime, fmtNumber, fmtRange } from '../../../utils/format';

export function AlertsPage() {
  const { data: alerts = [], isLoading } = useAlerts();
  const [selectedId, setSelectedId] = useState(null);
  const selected = alerts.find((a) => a.id === selectedId) ?? null;
  const sorted = [...alerts].sort((a, b) => {
    if (a.status === b.status) return b.createdAt.localeCompare(a.createdAt);
    if (a.status === 'OPEN') return -1;
    if (b.status === 'OPEN') return 1;
    if (a.status === 'ACKNOWLEDGED') return -1;
    if (b.status === 'ACKNOWLEDGED') return 1;
    return 0;
  });

  return (
    <div>
      <PageHeader subtitle="Monitor and manage anomalies and alerts across all departments." />
      <Card padded={false}>
        {!isLoading && sorted.length === 0 && <EmptyState icon={BellOff} title="No alerts" description="Nothing needs attention right now." />}
        {sorted.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Severity</th><th>Alert</th><th>Department</th><th>Raised</th><th>Status</th><th>Response</th><th></th></tr></thead>
              <tbody>
                {sorted.map((a) => (
                  <tr key={a.id} {...rowProps(() => setSelectedId(a.id))}>
                    <td><StatusBadge status={a.severity === 'CRITICAL' ? 'REJECTED' : 'CHANGES_REQUESTED'} label={a.severity === 'CRITICAL' ? 'Critical' : 'Warning'} /></td>
                    <td style={{ maxWidth: 320 }}>{a.message}{a.record?.variancePercent > 0 && <div className="text-muted">{fmtNumber(a.record.variancePercent, 0)}% over threshold</div>}</td>
                    <td>{a.departmentName ?? '—'}</td>
                    <td>{fmtDate(a.createdAt)}</td>
                    <td><StatusBadge status={a.status} label={a.status === 'OPEN' ? 'Open' : a.status === 'ACKNOWLEDGED' ? 'Acknowledged' : 'Resolved'} /></td>
                    <td style={{ maxWidth: 260 }}>{a.response ? <span style={{ whiteSpace: 'pre-wrap' }}>{a.response.responseText}</span> : <span className="text-muted">Awaiting contributor</span>}</td>
                    <td>{a.relatedResourceRecordId && <Link to={`${REVIEWER_ROUTES.SUBMISSIONS}?record=${a.relatedResourceRecordId}`} className="inline-icon" onClick={(e) => e.stopPropagation()}>View entry <ExternalLink size={13} aria-hidden="true" /></Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {selected && <AlertDrawer a={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function AlertDrawer({ a, onClose }) {
  const rec = a.record;
  const acknowledge = useAcknowledgeAlert();
  const closeAlert = useCloseAlert();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const handleAcknowledge = async () => {
    try {
      await acknowledge.mutateAsync(a.id);
      showToast('Alert acknowledged.', 'success');
    } catch {
      showToast('Failed to acknowledge alert.', 'error');
    }
  };

  const handleClose = async () => {
    const ok = await confirm({
      title: 'Close this alert?',
      message: 'This will resolve the alert and record that you closed it.',
      confirmLabel: 'Close alert',
      icon: CheckCircle2,
    });
    if (!ok) return;

    try {
      await closeAlert.mutateAsync({ id: a.id, comment: 'Closed by reviewer' });
      showToast('Alert closed.', 'success');
    } catch {
      showToast('Failed to close alert.', 'error');
    }
  };

  return (
    <Drawer
      open
      title={a.message}
      subtitle={`Raised ${fmtDateTime(a.createdAt)}`}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            {a.relatedResourceRecordId && (
              <Link to={`${REVIEWER_ROUTES.SUBMISSIONS}?record=${a.relatedResourceRecordId}`} className="inline-icon">
                View related entry <ExternalLink size={13} aria-hidden="true" />
              </Link>
            )}
          </div>
          {a.status !== 'RESOLVED' && (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {a.status === 'OPEN' && (
                <Button variant="secondary" size="sm" icon={Check} onClick={handleAcknowledge} loading={acknowledge.isPending}>
                  Acknowledge
                </Button>
              )}
              <Button size="sm" icon={CheckCircle2} onClick={handleClose} loading={closeAlert.isPending}>
                Close alert
              </Button>
            </div>
          )}
        </div>
      }
    >
      <p className="row-actions" style={{ marginBottom: 'var(--space-4)' }}>
        <StatusBadge status={a.severity === 'CRITICAL' ? 'REJECTED' : 'CHANGES_REQUESTED'} label={a.severity === 'CRITICAL' ? 'Critical' : 'Warning'} />
        <StatusBadge status={a.status} label={a.status === 'OPEN' ? 'Open' : a.status === 'ACKNOWLEDGED' ? 'Acknowledged' : 'Resolved'} />
      </p>
      <DetailList items={[['Department', a.departmentName], ['Alert type', a.type]]} />
      {rec && (
        <>
          <h3 className="section-title">Entry that triggered it</h3>
          <DetailList items={[
            ['Resource', rec.resourceTypeName],
            ['Activity', `${fmtNumber(rec.quantity, 2)} ${rec.unit}`],
            ['Period', fmtRange(rec.periodStart, rec.periodEnd)],
            ['Emissions', rec.co2eKg == null ? 'Calculated on approval' : fmtCo2e(rec.co2eKg)],
            ['Variance vs threshold', rec.varianceVsThreshold == null ? null : `${rec.varianceVsThreshold > 0 ? '+' : ''}${fmtNumber(rec.varianceVsThreshold, 2)} ${rec.unit} (${fmtNumber(rec.variancePercent, 0)}%)`],
          ]} />
        </>
      )}
      <h3 className="section-title">Contributor response</h3>
      {a.response ? (
        <div className="callout callout--success">
          <strong>{a.response.action === 'fixed' ? 'Corrected' : a.response.action === 'closed' ? 'Closed' : 'Confirmed accurate'}</strong>
          {a.response.respondedByName ? ` by ${a.response.respondedByName}` : ''} · {fmtDate(a.response.createdAt)}
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{a.response.responseText}</p>
        </div>
      ) : <p className="text-muted">Awaiting contributor response or reviewer action.</p>}
    </Drawer>
  );
}
