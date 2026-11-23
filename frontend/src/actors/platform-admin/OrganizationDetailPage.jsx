import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../../services/apiClient';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, Notice, PageHeader, Stat, StatusBadge } from '../../components/ui';
import { fmtDate, fmtInr } from '../../utils/formatters';
import { ORG_STATUS } from './OrganizationsPage';

const reasonField = (label = 'Reason', hint = 'Written to the platform activity log.') => ({ name: 'reason', type: 'textarea', label, required: true, minLength: 10, hint });

export default function OrganizationDetailPage() {
  const { id } = useParams();
  const { pushToast } = useToast();
  const dialog = useDialog();
  const { data, refetch } = useApi(`/platform/organizations/${id}`);
  if (!data) return <div className="h-40 animate-pulse" />;
  const o = data.organization;
  const call = async (path, method, body, ok) => { try { await apiFetch(path, { method, body: JSON.stringify(body) }); pushToast(ok); refetch(); } catch (e) { pushToast(e.message, 'error'); } };

  async function setStatus() {
    const v = await dialog.form({ title: 'Change status', description: `Now: ${ORG_STATUS[o.status]}. Suspending signs everyone out at once.`, submitLabel: 'Change', fields: [{ name: 'status', type: 'select', label: 'New status', required: true, options: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'].filter((s) => s !== o.status).map((s) => ({ value: s, label: ORG_STATUS[s] })) }, reasonField()] });
    if (v) call(`/platform/organizations/${id}/status`, 'PATCH', { status: v.status, reason: v.reason.trim() }, 'Status changed.');
  }
  async function extend() {
    const v = await dialog.form({ title: 'Extend the trial', submitLabel: 'Extend', fields: [{ name: 'days', type: 'number', label: 'Extra days', required: true, unit: 'days', defaultValue: '14', hint: 'Up to 60.' }, reasonField()] });
    if (v) call(`/platform/organizations/${id}/extend-trial`, 'POST', { days: Number(v.days), reason: v.reason.trim() }, 'Trial extended.');
  }
  async function close() {
    const v = await dialog.form({ title: 'Ask to close this company', description: 'A second platform administrator must approve before anything is closed.', danger: true, submitLabel: 'Send for approval', fields: [reasonField('Why is it leaving?')] });
    if (v) call('/platform/approvals', 'POST', { organizationId: id, actionType: 'ORG_CLOSE_OFFBOARD', reason: v.reason.trim() }, 'Sent to a second administrator.');
  }
  const closed = o.status === 'CLOSED';
  return (
    <div>
      <PageHeader title={o.name} description={`${o.plan?.name || 'No plan'} · joined ${fmtDate(o.createdAt)}`} actions={<div className="flex gap-2 items-center"><StatusBadge status={o.status === 'ACTIVE' ? 'ACTIVE' : o.status} label={ORG_STATUS[o.status]} /><Link to="/platform/organizations" className="text-sm underline">All companies</Link></div>} />
      {data.openApprovals > 0 && <Notice tone="warn" className="mb-4">{data.openApprovals} request{data.openApprovals > 1 ? 's are' : ' is'} waiting for a second administrator.</Notice>}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <Stat label="People" value={o._count.users} /><Stat label="Sites" value={o._count.facilities} /><Stat label="Last sign-in" value={data.lastLoginAt ? fmtDate(data.lastLoginAt) : 'Never'} /><Stat label="Last data entered" value={data.lastEntryAt ? fmtDate(data.lastEntryAt) : 'None'} />
      </div>
      {!closed && <Card title="Support actions" description="Every action needs a reason and is recorded. You can look after the account, but you cannot read the company’s emission records." className="mb-6"><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={setStatus}>Change status</Button>{o.status === 'TRIAL' && <Button variant="secondary" onClick={extend}>Extend trial{o.trialEndsAt ? ` (ends ${fmtDate(o.trialEndsAt)})` : ''}</Button>}<Link to={`/platform/users?organizationId=${id}`}><Button variant="secondary">See their people</Button></Link><Button variant="danger" onClick={close}>Ask to close</Button></div></Card>}
      <Card title="Recent invoices" padded={false}>
        {data.invoices.length === 0 ? <p className="px-5 py-4 text-sm text-muted">No invoices.</p> : <ul className="divide-y divide-line">{data.invoices.map((i) => <li key={i.id} className="flex flex-wrap gap-3 px-5 py-2.5 justify-between"><span className="font-medium">{i.invoiceNumber}</span><span className="tabular-nums">{fmtInr(i.totalInr)}</span><StatusBadge status={i.status === 'PAID' ? 'ACTIVE' : i.status} label={i.status === 'PAID' ? 'Paid' : i.status === 'UNPAID' ? 'Waiting for payment' : 'Cancelled'} /><span className="text-sm text-muted">{fmtDate(i.issuedAt)}</span></li>)}</ul>}
      </Card>
    </div>
  );
}
