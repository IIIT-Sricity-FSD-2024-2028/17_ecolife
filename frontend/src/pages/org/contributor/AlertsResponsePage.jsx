import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellOff, ExternalLink, Send, CheckCircle2, Hourglass, CheckCheck } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { EmptyState } from '../../../components/shared/EmptyState';
import { Button } from '../../../components/ui/Button';
import { Drawer } from '../../../components/ui/Drawer';
import { DetailList } from '../../../components/shared/DetailList';
import { FormField, TextArea, Select } from '../../../components/ui/FormField';
import { rowProps } from '../../../components/shared/rowProps';
import { useAlerts, useRespondToAlert, useCloseAlert } from '../../../hooks/useOrgData';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { alertResponseSchema, validate } from '../../../schemas/formSchemas';
import { ApiError } from '../../../services/apiClient';
import { CONTRIBUTOR_ROUTES } from '../../../constants/routes';
import { fmtCo2e, fmtDate, fmtDateTime, fmtNumber, fmtRange } from '../../../utils/format';

export function AlertsResponsePage() {
  const auth = useAuth();
  const isOrgAdmin = auth?.user?.role === 'ORG_ADMIN';
  const { data: alerts = [], isLoading } = useAlerts();

  const [tab, setTab] = useState('OPEN');
  const [selectedId, setSelectedId] = useState(null);
  const selected = alerts.find((a) => a.id === selectedId) ?? null;

  const open = alerts.filter((a) => a.status === 'OPEN' || a.status === 'ACKNOWLEDGED');
  const resolved = alerts.filter((a) => a.status === 'RESOLVED');
  const currentTabList = (tab === 'OPEN' ? open : resolved).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <PageHeader
        subtitle={
          isOrgAdmin
            ? 'Monitor and manage anomalies and alerts across all departments.'
            : 'Explain unusual usage in your department and record what you did about it.'
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'OPEN', label: 'Needs response', icon: Hourglass, count: open.length },
          { value: 'RESOLVED', label: 'Resolved', icon: CheckCheck, count: resolved.length },
        ]}
      />

      <Card padded={false}>
        {!isLoading && currentTabList.length === 0 && (
          <EmptyState
            icon={BellOff}
            title={tab === 'OPEN' ? 'No open alerts' : 'Nothing resolved yet'}
            description={tab === 'OPEN' ? 'Nothing needs attention right now.' : undefined}
          />
        )}
        {currentTabList.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Alert</th>
                  <th>Department</th>
                  <th>Raised</th>
                  <th>Status</th>
                  <th>Response</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {currentTabList.map((a) => (
                  <tr key={a.id} {...rowProps(() => setSelectedId(a.id))}>
                    <td>
                      <StatusBadge
                        status={a.severity === 'CRITICAL' ? 'REJECTED' : 'CHANGES_REQUESTED'}
                        label={a.severity === 'CRITICAL' ? 'Critical' : 'Warning'}
                      />
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      {a.message}
                      {a.record?.variancePercent > 0 && (
                        <div className="text-muted">{fmtNumber(a.record.variancePercent, 0)}% over threshold</div>
                      )}
                    </td>
                    <td>{a.departmentName ?? '—'}</td>
                    <td>{fmtDate(a.createdAt)}</td>
                    <td>
                      <StatusBadge
                        status={a.status}
                        label={a.status === 'OPEN' ? 'Open' : a.status === 'ACKNOWLEDGED' ? 'Acknowledged' : 'Resolved'}
                      />
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      {a.response ? (
                        <span style={{ whiteSpace: 'pre-wrap' }}>{a.response.responseText}</span>
                      ) : (
                        <span className="text-muted">Awaiting response</span>
                      )}
                    </td>
                    <td>
                      {a.relatedResourceRecordId && (
                        <Link
                          to={`${CONTRIBUTOR_ROUTES.HISTORY}?record=${a.relatedResourceRecordId}`}
                          className="inline-icon"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View entry <ExternalLink size={13} aria-hidden="true" />
                        </Link>
                      )}
                    </td>
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
  const auth = useAuth();
  const isOrgAdmin = auth?.user?.role === 'ORG_ADMIN';
  const respond = useRespondToAlert();
  const closeAlert = useCloseAlert();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [action, setAction] = useState('fixed');
  const [explanation, setExplanation] = useState('');
  const [measures, setMeasures] = useState('');
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});

  const submit = async () => {
    setError(null);
    const check = validate(alertResponseSchema(action === 'fixed'), { explanation, measures });
    setErrors(check.errors);
    if (!check.ok) return;

    const ok = await confirm({
      title: 'Submit your response?',
      message: `This marks the alert as resolved (${
        action === 'fixed' ? 'data corrected' : 'data confirmed accurate'
      }) and records your explanation in the audit trail. It cannot be changed afterwards.`,
      confirmLabel: 'Submit response',
      icon: Send,
    });
    if (!ok) return;

    const responseText = [
      `Explanation: ${check.data.explanation}`,
      check.data.measures && `Corrective measures: ${check.data.measures}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      await respond.mutateAsync({ id: a.id, payload: { responseText, action } });
      showToast('Alert resolved successfully.', 'success');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  const handleAdminClose = async () => {
    const ok = await confirm({
      title: 'Close this alert?',
      message: 'This will resolve the alert as reviewed by Org Admin.',
      confirmLabel: 'Close alert',
      icon: CheckCircle2,
    });
    if (!ok) return;

    try {
      await closeAlert.mutateAsync({ id: a.id, comment: 'Closed by Org Admin' });
      showToast('Alert closed.', 'success');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
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
              <Link to={`${CONTRIBUTOR_ROUTES.HISTORY}?record=${a.relatedResourceRecordId}`} className="inline-icon">
                View related entry <ExternalLink size={13} aria-hidden="true" />
              </Link>
            )}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <p className="row-actions" style={{ marginBottom: 'var(--space-4)' }}>
        <StatusBadge
          status={a.severity === 'CRITICAL' ? 'REJECTED' : 'CHANGES_REQUESTED'}
          label={a.severity === 'CRITICAL' ? 'Critical' : 'Warning'}
        />
        <StatusBadge
          status={a.status}
          label={a.status === 'OPEN' ? 'Open' : a.status === 'ACKNOWLEDGED' ? 'Acknowledged' : 'Resolved'}
        />
      </p>

      <DetailList items={[['Department', a.departmentName], ['Alert type', a.type]]} />

      {rec && (
        <>
          <h3 className="section-title">Entry that triggered it</h3>
          <DetailList
            items={[
              ['Resource', rec.resourceTypeName],
              ['Activity', `${fmtNumber(rec.quantity, 2)} ${rec.unit}`],
              ['Period', fmtRange(rec.periodStart, rec.periodEnd)],
              ['Emissions', rec.co2eKg == null ? 'Calculated on approval' : fmtCo2e(rec.co2eKg)],
              [
                'Variance vs threshold',
                rec.varianceVsThreshold == null
                  ? null
                  : `${rec.varianceVsThreshold > 0 ? '+' : ''}${fmtNumber(rec.varianceVsThreshold, 2)} ${rec.unit} (${fmtNumber(rec.variancePercent, 0)}%)`,
              ],
            ]}
          />
        </>
      )}

      <h3 className="section-title">Contributor response</h3>
      {a.response ? (
        <div className="callout callout--success">
          <strong>
            {a.response.action === 'fixed'
              ? 'Corrected'
              : a.response.action === 'closed'
              ? 'Closed'
              : 'Confirmed accurate'}
          </strong>
          {a.response.respondedByName ? ` by ${a.response.respondedByName}` : ''} · {fmtDate(a.response.createdAt)}
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{a.response.responseText}</p>
        </div>
      ) : (
        <div className="stack">
          <FormField label="Outcome">
            <Select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="fixed">The data was wrong — I corrected it</option>
              <option value="confirmed_accurate">The data is accurate</option>
            </Select>
          </FormField>

          <FormField
            label="Explanation"
            required
            hint="What caused this unusual usage? E.g. Quarterly equipment load testing"
            error={errors.explanation}
          >
            <TextArea
              rows={3}
              maxLength={1200}
              error={errors.explanation}
              placeholder="Explain the reason for this usage spike..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </FormField>

          <FormField
            label={action === 'fixed' ? 'Corrective measures' : 'Corrective measures (optional)'}
            required={action === 'fixed'}
            error={errors.measures}
            hint={action === 'fixed' ? 'What was changed to fix the discrepancy?' : 'Any steps planned to mitigate future spikes?'}
          >
            <TextArea
              rows={2}
              maxLength={700}
              error={errors.measures}
              placeholder="What have you changed or will you change?"
              value={measures}
              onChange={(e) => setMeasures(e.target.value)}
            />
          </FormField>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <div className="row-actions">
            <Button icon={Send} onClick={submit} loading={respond.isPending}>
              Submit response
            </Button>
            {isOrgAdmin && (
              <Button variant="secondary" onClick={handleAdminClose} loading={closeAlert.isPending}>
                Dismiss alert
              </Button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
