import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAction } from '../../hooks/useAction';
import { useForm } from '../../hooks/useForm';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Notice, PageHeader, StatusBadge, TextField } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { fmtDate } from '../../utils/formatters';

export default function SupportUsersPage() {
  const [sp] = useSearchParams();
  const orgId = sp.get('organizationId') || '';
  const send = useAction();
  const dialog = useDialog();
  const f = useForm('support-users', { q: '' });
  const { q } = f.values;
  const setQ = (v) => f.set('q', v);

  async function act(u, kind) {
    const T = { unlock: ['Unlock this account', 'unlock', 'Unlocked.'], reset: ['Switch off two-step sign-in', 'reset-two-factor', 'Two-step sign-in switched off. They are signed out everywhere and can set it up again.'], resend: ['Send the verification email again', 'resend-verification', 'Email queued.'] }[kind];
    const v = await dialog.form({ title: `${T[0]}: ${u.fullName}`, description: 'The reason is written to the platform activity log.', submitLabel: 'Do it', danger: kind === 'reset', fields: [{ name: 'reason', type: 'textarea', label: 'Reason', required: true, minLength: 10, placeholder: 'e.g. Verified by phone with the company admin on 23 Nov.' }] });
    if (!v) return;
    await send({ path: `/platform/users/${u.id}/${T[1]}`, method: 'POST', body: { reason: v.reason.trim() }, toast: T[2] });
  }
  return (
    <div>
      <PageHeader title="Find a person" description="Help someone who is locked out or cannot verify their email." />
      <Notice tone="info" className="mb-4">You can see who a person is and fix their sign-in. You cannot see their company’s data.{orgId && ' Showing one company only.'}</Notice>
      <DataGrid endpoint="/platform/users" params={{ q, organizationId: orgId }} exportName="people"
        toolbar={<TextField className="w-64" label="" aria-label="Search" placeholder="Name or email" value={q} onChange={setQ} />}
        columns={[{ key: 'n', label: 'Person', render: (r) => <><div className="font-medium">{r.fullName}</div><div className="text-xs text-muted">{r.email}</div></>, value: (r) => r.email },
          { key: 'o', label: 'Company', render: (r) => r.organization?.name, value: (r) => r.organization?.name }, { key: 's', label: 'State', render: (r) => <div className="flex flex-wrap gap-1">{r.isLocked && <StatusBadge status="DANGER" label="Locked" />}{!r.emailVerifiedAt && <StatusBadge status="PENDING" label="Email not verified" />}{!r.isActive && <StatusBadge status="PENDING" label="No access" />}{r.isActive && !r.isLocked && r.emailVerifiedAt && <StatusBadge status="ACTIVE" label="Fine" />}</div>, value: (r) => (r.isLocked ? 'Locked' : r.isActive ? 'Fine' : 'No access') },
          { key: 'l', label: 'Last sign-in', hideOnMobile: true, render: (r) => (r.lastLoginAt ? fmtDate(r.lastLoginAt) : 'Never'), value: (r) => r.lastLoginAt },
          { key: 'a', label: '', render: (r) => <div className="flex gap-1.5 justify-end">{r.isLocked && <Button size="sm" onClick={() => act(r, 'unlock')}>Unlock</Button>}{!r.emailVerifiedAt && <Button size="sm" variant="secondary" onClick={() => act(r, 'resend')}>Resend email</Button>}{r.twoFactorEnabled && <Button size="sm" variant="secondary" onClick={() => act(r, 'reset')}>Reset 2-step</Button>}</div> }]}
        emptyTitle="No one found" emptyText="Search by name or email." />
    </div>
  );
}
