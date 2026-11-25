import React, { useMemo } from 'react';
import QRCode from 'qrcode';
import { useApi } from '../../hooks/useApi';
import { useAction } from '../../hooks/useAction';
import { useForm } from '../../hooks/useForm';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../components/ui/Dialogs';
import { Button, Card, FormGrid, Notice, PageHeader, StatusBadge, TextField } from '../../components/ui';
import { fmtDate } from '../../utils/formatters';
import { ROLE } from '../../utils/labels';

/** Draws the QR code straight from the text, so it needs no loading state. */
function Qr({ uri }) {
  const q = useMemo(() => QRCode.create(uri, { errorCorrectionLevel: 'M' }).modules, [uri]);
  const cells = [];
  for (let y = 0; y < q.size; y += 1) for (let x = 0; x < q.size; x += 1) if (q.get(y, x)) cells.push(<rect key={`${x}-${y}`} x={x + 1} y={y + 1} width="1" height="1" />);
  return <svg viewBox={`0 0 ${q.size + 2} ${q.size + 2}`} width="168" height="168" role="img" aria-label="QR code to add Tropos to your authenticator app" className="rounded-md border border-line bg-white" shapeRendering="crispEdges"><g fill="#000">{cells}</g></svg>;
}

export default function ProfileSecurityPage() {
  const { user, organization, refreshMe } = useAuth();
  const { pushToast } = useToast();
  const dialog = useDialog();
  const act = useAction();
  const { data: sessions } = useApi(user?.isPlatformAdmin ? null : '/sessions');
  const f = useForm('profile', { setup: null, code: '', recovery: [], current: '', next: '', confirm: '', busy: '' });
  const { setup, code, recovery, current, next, confirm, busy } = f.values;

  async function start2fa() { f.patch({ busy: '2fa' }); const r = await act({ path: '/auth/2fa/setup', method: 'POST' }); f.patch({ busy: '', ...(r ? { setup: r } : {}) }); }
  async function enable2fa(e) {
    e.preventDefault(); f.patch({ busy: 'en' });
    const r = await act({ path: '/auth/2fa/enable', method: 'POST', body: { code }, toast: 'Two-step sign-in is on.' });
    f.patch({ busy: '', ...(r ? { recovery: r.recoveryCodes || [], setup: null, code: '' } : {}) });
    if (r) refreshMe();
  }
  async function disable2fa() {
    const v = await dialog.form({ title: 'Turn off two-step sign-in', description: 'Your account will be protected by your password alone.', danger: true, submitLabel: 'Turn off', fields: [
      { name: 'password', type: 'password', label: 'Your password', required: true }, { name: 'code', type: 'text', label: 'Code from your app, or a recovery code', required: true }] });
    if (!v) return;
    const r = await act({ path: '/auth/2fa/disable', method: 'POST', body: { password: v.password, ...(v.code.trim().length > 6 ? { recoveryCode: v.code.trim() } : { code: v.code.trim() }) }, toast: 'Two-step sign-in is off.' });
    if (r) { f.patch({ recovery: [] }); refreshMe(); }
  }
  async function changePassword(e) {
    e.preventDefault();
    if (next !== confirm) { pushToast('The new passwords do not match.', 'error'); return; }
    f.patch({ busy: 'pw' });
    const r = await act({ path: '/auth/change-password', method: 'POST', body: { currentPassword: current, newPassword: next }, toast: 'Password changed. Your other devices were signed out.' });
    f.patch({ busy: '', ...(r ? { current: '', next: '', confirm: '' } : {}) });
  }
  const resend = () => act({ path: '/auth/resend-verification', method: 'POST', toast: 'Verification email sent.' });
  const revoke = (s) => act({ path: `/sessions/${s.id}`, method: 'DELETE', toast: 'Signed out.' });

  const device = (ua = '') => (/Mobile|Android|iPhone/i.test(ua) ? 'Phone' : 'Computer') + (/Firefox/i.test(ua) ? ' · Firefox' : /Edg/i.test(ua) ? ' · Edge' : /Chrome/i.test(ua) ? ' · Chrome' : /Safari/i.test(ua) ? ' · Safari' : '');
  const active = (sessions || []).filter((s) => !s.revokedAt);

  return (
    <div className="max-w-3xl">
      <PageHeader title="My account" description="Your details and how you sign in." />
      <Card title={user?.fullName} description={user?.email} className="mb-6" actions={user?.emailVerifiedAt ? <StatusBadge status="ACTIVE" label="Email verified" /> : <Button size="sm" variant="secondary" onClick={resend}>Verify email</Button>}>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm"><div><dt className="text-muted">Company</dt><dd>{organization?.name || 'Tropos platform'}</dd></div><div><dt className="text-muted">What you can do</dt><dd>{user?.isPlatformAdmin ? 'Platform administrator' : (user?.roles || []).map((r) => ROLE[r] || r).join(', ')}</dd></div></dl>
      </Card>

      <Card title="Two-step sign-in" description="Asks for a code from your phone as well as your password." className="mb-6" actions={user?.twoFactorEnabled ? <StatusBadge status="ACTIVE" label="On" /> : <StatusBadge status="PENDING" label="Off" />}>
        {recovery.length > 0 && <Notice tone="warn" className="mb-4 flex-col"><div className="font-medium mb-1">Save these recovery codes now. They are shown only once.</div><div className="tabular-nums select-all leading-7">{recovery.join('   ')}</div><div className="mt-1">Each code works once if you lose your phone.</div></Notice>}
        {user?.twoFactorEnabled ? <Button variant="secondary" onClick={disable2fa}>Turn off</Button> : setup ? (
          <form onSubmit={enable2fa} className="flex flex-wrap gap-5 items-start"><Qr uri={setup.otpauthUri} />
            <div className="flex-1 min-w-[14rem] space-y-3"><p className="text-sm">1. Open an authenticator app such as Google Authenticator or Microsoft Authenticator and scan the picture.</p><p className="text-sm text-muted">Cannot scan? Type this key instead: <strong className="select-all break-all text-text">{setup.secret}</strong></p><p className="text-sm">2. Type the 6-digit code it shows.</p>
              <div className="flex gap-2"><TextField className="w-40" label="" aria-label="6-digit code" inputMode="numeric" maxLength={6} placeholder="123456" {...f.field('code')} /><Button type="submit" loading={busy === 'en'} disabled={code.length !== 6}>Turn on</Button></div></div></form>
        ) : <Button loading={busy === '2fa'} onClick={start2fa}>Set up</Button>}
      </Card>

      <Card title="Change password" className="mb-6">
        <form onSubmit={changePassword} className="space-y-4">
          <FormGrid cols={1}><TextField label="Current password" type="password" autoComplete="current-password" {...f.field('current')} /><TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters." {...f.field('next')} /><TextField label="Repeat the new password" type="password" autoComplete="new-password" {...f.field('confirm')} /></FormGrid>
          <div className="flex justify-end"><Button type="submit" loading={busy === 'pw'} disabled={!current || next.length < 10 || confirm !== next}>Change password</Button></div>
        </form>
      </Card>

      {!user?.isPlatformAdmin && <Card title="Where you are signed in" padded={false}>
        {!sessions ? <div className="h-16 animate-pulse" /> : <ul className="divide-y divide-line">{active.map((s, i) => <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><div className="flex-1"><div className="font-medium">{device(s.userAgent)}{i === 0 && <span className="text-muted font-normal"> (most recent)</span>}</div><div className="text-sm text-muted">{s.ipAddress || 'This computer'} · last active {fmtDate(s.lastActiveAt)}</div></div>{i > 0 && <Button size="sm" variant="secondary" onClick={() => revoke(s)}>Sign out</Button>}</li>)}</ul>}
      </Card>}
    </div>
  );
}
