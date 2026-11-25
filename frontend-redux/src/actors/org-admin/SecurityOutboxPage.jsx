import React from 'react';
import { Copy, Plus } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useAction } from '../../hooks/useAction';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, EmptyState, Notice, PageHeader, StatusBadge } from '../../components/ui';
import { fmtDate } from '../../utils/formatters';

const MAIL = { PENDING: 'Waiting to send', SENT: 'Sent', FAILED: 'Failed' };

export default function SecurityOutboxPage() {
  const { pushToast } = useToast();
  const dialog = useDialog();
  const act = useAction();
  const { data: keys } = useApi('/org/api-keys');
  const { data: mail } = useApi('/email-outbox');
  const { data: sites } = useApi('/facilities');
  const f = useForm('securityOutbox', { fresh: '' });
  const fresh = f.values.fresh;

  async function addKey() {
    const v = await dialog.form({ title: 'Create an access key', description: 'A key lets a machine, such as a meter logger or your ERP, send readings into Tropos. It can only add entries.', submitLabel: 'Create key', fields: [
      { name: 'name', type: 'text', label: 'What will use it?', required: true, minLength: 2, placeholder: 'e.g. Pune plant meter logger' },
      { name: 'facilityId', type: 'select', label: 'Limit to one site', hint: 'Leave empty to allow all sites.', options: (sites || []).filter((s) => s.approvalStatus === 'APPROVED').map((s) => ({ value: s.id, label: s.name })) },
      { name: 'days', type: 'number', label: 'Expires after', unit: 'days', hint: 'Leave empty for no expiry. Shorter is safer.' }] });
    if (!v) return;
    const r = await act({ path: '/org/api-keys', method: 'POST', body: { name: v.name.trim(), facilityIds: v.facilityId ? [v.facilityId] : [], expiresInDays: v.days === '' ? undefined : Number(v.days) } });
    if (r) f.set('fresh', r.rawKey);
  }
  async function revoke(k) {
    if (!(await dialog.confirm({ title: `Revoke “${k.name}”?`, message: 'Anything using this key stops working at once.', confirmLabel: 'Revoke', danger: true }))) return;
    await act({ path: `/org/api-keys/${k.id}`, method: 'DELETE', toast: 'Key revoked.' });
  }
  const resend = (m) => act({ path: `/email-outbox/${m.id}/mark-sent`, method: 'POST', toast: 'Sending now.' });

  return (
    <div>
      <PageHeader title="Security and access keys" description="Machine access to your workspace, and the emails Tropos sends for you." />
      {fresh && <Notice tone="warn" className="mb-4 flex-wrap gap-2"><span>Copy this key now. It is shown only once: <strong className="select-all break-all">{fresh}</strong></span><button className="underline inline-flex items-center gap-1" onClick={() => { navigator.clipboard?.writeText(fresh); pushToast('Key copied.'); }}><Copy className="w-3.5 h-3.5" />Copy</button><button className="underline" onClick={() => f.set('fresh', '')}>I have saved it</button></Notice>}
      <Card title="Access keys" actions={<Button size="sm" onClick={addKey}><Plus className="w-3.5 h-3.5" /> Create a key</Button>} padded={false} className="mb-6">
        {!keys ? <div className="h-16 animate-pulse" /> : keys.length === 0 ? <EmptyState title="No keys">Create one when a meter logger or another system should send data in.</EmptyState> : (
          <ul className="divide-y divide-line">{keys.map((k) => <li key={k.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><div className="flex-1 min-w-[12rem]"><div className="font-medium">{k.name}</div><div className="text-sm text-muted">Starts with {k.keyPrefix}…{k.expiresAt ? ` · expires ${fmtDate(k.expiresAt)}` : ' · no expiry'}{k.lastUsedAt ? ` · last used ${fmtDate(k.lastUsedAt)}` : ' · never used'}</div></div><StatusBadge status={k.isActive ? 'ACTIVE' : 'PENDING'} label={k.isActive ? 'Working' : 'Revoked'} />{k.isActive && <Button size="sm" variant="secondary" onClick={() => revoke(k)}>Revoke</Button>}</li>)}</ul>)}
      </Card>
      <Card title="Emails sent for you" description="Invitations, password links and alerts." padded={false}>
        {!mail ? <div className="h-16 animate-pulse" /> : mail.length === 0 ? <EmptyState title="No emails yet" /> : (
          <ul className="divide-y divide-line">{mail.slice(0, 25).map((m) => <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5"><div className="flex-1 min-w-[12rem]"><div className="font-medium">{m.subject}</div><div className="text-sm text-muted">{m.toEmail} · {fmtDate(m.createdAt)}</div></div><StatusBadge status={m.status === 'SENT' ? 'ACTIVE' : m.status} label={MAIL[m.status] || m.status} />{m.status !== 'SENT' && <Button size="sm" variant="secondary" onClick={() => resend(m)}>Send now</Button>}</li>)}</ul>)}
      </Card>
    </div>
  );
}
