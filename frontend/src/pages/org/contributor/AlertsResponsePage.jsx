import { useState } from 'react';
import { BellOff, Hourglass, CheckCheck, Send } from 'lucide-react';
import { useAlerts, useRespondToAlert } from '../../../hooks/useOrgData';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Tabs } from '../../../components/ui/Tabs';
import { FormField, TextArea, Select } from '../../../components/ui/FormField';
import { alertResponseSchema, validate } from '../../../schemas/formSchemas';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { useToast } from '../../../context/ToastContext';
import { ApiError } from '../../../services/apiClient';
import { fmtCo2e, fmtDate, fmtNumber, fmtRange } from '../../../utils/format';

export function AlertsResponsePage() {
  const { data: alerts = [], isLoading } = useAlerts();
  const [tab, setTab] = useState('OPEN');
  const open = alerts.filter((a) => a.status === 'OPEN');
  const resolved = alerts.filter((a) => a.status === 'RESOLVED');
  const shown = tab === 'OPEN' ? open : resolved;

  return (
    <div>
      <PageHeader subtitle="Explain unusual usage in your department and record what you did about it." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'OPEN', label: 'Needs response', icon: Hourglass, count: open.length }, { value: 'RESOLVED', label: 'Resolved', icon: CheckCheck, count: resolved.length }]} />

      {!isLoading && shown.length === 0 && (
        <Card><EmptyState icon={BellOff} title={tab === 'OPEN' ? 'No open alerts' : 'Nothing resolved yet'} description={tab === 'OPEN' ? 'Nothing needs your attention right now.' : undefined} /></Card>
      )}
      <div className="stack">
        {shown.map((a) => <AlertCard key={a.id} alert={a} />)}
      </div>
    </div>
  );
}

function AlertCard({ alert: a }) {
  const respond = useRespondToAlert();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [action, setAction] = useState('fixed');
  const [explanation, setExplanation] = useState('');
  const [measures, setMeasures] = useState('');
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const rec = a.record;

  const submit = async () => {
    setError(null);
    const check = validate(alertResponseSchema(action === 'fixed'), { explanation, measures });
    setErrors(check.errors);
    if (!check.ok) return;
    const ok = await confirm({
      title: 'Submit your response?',
      message: `This marks the alert as resolved (${action === 'fixed' ? 'data corrected' : 'data confirmed accurate'}) and records your explanation in the audit trail. It can’t be changed afterwards.`,
      confirmLabel: 'Submit response',
      icon: Send,
    });
    if (!ok) return;
    // The API stores one response text, so both parts are kept together in it.
    const responseText = [`Explanation: ${check.data.explanation}`, check.data.measures && `Corrective measures: ${check.data.measures}`].filter(Boolean).join('\n\n');
    try {
      await respond.mutateAsync({ id: a.id, payload: { responseText, action } });
      showToast('Alert resolved.', 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
        <div>
          <p style={{ fontWeight: 'var(--font-weight-medium)' }}>{a.message}</p>
          <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>{fmtDate(a.createdAt)}{a.departmentName ? ` · ${a.departmentName}` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
          <StatusBadge status={a.severity === 'CRITICAL' ? 'REJECTED' : 'CHANGES_REQUESTED'} label={a.severity === 'CRITICAL' ? 'Critical' : 'Warning'} />
          <StatusBadge status={a.status} label={a.status === 'OPEN' ? 'Open' : 'Resolved'} />
        </div>
      </div>

      {rec && (
        <div className="table-scroll" style={{ marginBottom: 'var(--space-4)' }}>
          <table className="data-table">
            <thead><tr><th>Resource</th><th>Activity</th><th className="num">Emissions impact</th><th className="num">Variance vs threshold</th></tr></thead>
            <tbody>
              <tr>
                <td>{rec.resourceTypeName}</td>
                <td>{fmtNumber(rec.quantity, 2)} {rec.unit}<br /><span className="text-muted">{fmtRange(rec.periodStart, rec.periodEnd)}</span></td>
                <td className="num">{rec.co2eKg == null ? <span className="text-muted">Calculated on approval</span> : fmtCo2e(rec.co2eKg)}</td>
                <td className="num">
                  {rec.varianceVsThreshold == null ? '—' : `${rec.varianceVsThreshold > 0 ? '+' : ''}${fmtNumber(rec.varianceVsThreshold, 2)} ${rec.unit} (${fmtNumber(rec.variancePercent, 0)}%)`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {a.status === 'OPEN' ? (
        <>
          <FormField label="Outcome">
            <Select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="fixed">The data was wrong — I corrected it</option>
              <option value="confirmed_accurate">The data is accurate</option>
            </Select>
          </FormField>
          <FormField label="Explanation" required hint="What caused this usage?" error={errors.explanation}>
            <TextArea rows={3} maxLength={1200} error={errors.explanation} placeholder="e.g. A one-off equipment test ran for three days." value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          </FormField>
          <FormField label={action === 'fixed' ? 'Corrective measures' : 'Corrective measures (optional)'} required={action === 'fixed'} error={errors.measures}>
            <TextArea rows={3} maxLength={700} error={errors.measures} placeholder="What have you changed or will you change?" value={measures} onChange={(e) => setMeasures(e.target.value)} />
          </FormField>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <Button icon={Send} onClick={submit} loading={respond.isPending}>Submit response</Button>
        </>
      ) : (
        a.response && (
          <div className="callout callout--success">
            <strong>{a.response.action === 'fixed' ? 'Corrected' : 'Confirmed accurate'}</strong>
            {a.response.respondedByName ? ` by ${a.response.respondedByName}` : ''} · {fmtDate(a.response.createdAt)}
            <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{a.response.responseText}</p>
          </div>
        )
      )}
    </Card>
  );
}
