import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { apiFetch, setToken } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { ACTOR_LABELS } from '../../config/actorNavigation';
import { AuthShell } from '../../components/ui/AuthShell';
import { Button, Notice, TextField } from '../../components/ui';

export default function InviteAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { refreshMe } = useAuth();
  const [info, setInfo] = useState(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { apiFetch(`/auth/invitations/${token}`).then(setInfo).catch((e) => setErr(e.message || 'This invitation is no longer valid. Ask your administrator to send a new one.')); }, [token]);

  async function accept(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const res = await apiFetch(`/auth/invitations/${token}/accept`, { method: 'POST', body: JSON.stringify({ fullName, password }) });
      setToken(res.token); await refreshMe(); navigate('/', { replace: true });
    } catch (e2) { setErr(e2.message || 'We could not accept the invitation.'); } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Join your team on Tropos" subtitle={info ? `${info.organizationName} has invited you.` : 'Checking your invitation…'}>
      {err && <Notice tone="danger" className="mb-4">{err}</Notice>}
      {info && (
        <form onSubmit={accept} className="space-y-4">
          <div className="card p-4 text-sm space-y-1">
            <div><span className="text-muted">Email: </span><strong>{info.email}</strong></div>
            <div><span className="text-muted">Your role: </span><strong>{info.roles.map((r) => ACTOR_LABELS[r] || r).join(', ')}</strong></div>
          </div>
          <TextField label="Your full name" required placeholder="e.g. Rajesh Kulkarni" value={fullName} onChange={setFullName} />
          <TextField label="Create a password" type="password" required minLength={10} autoComplete="new-password" placeholder="At least 10 characters" value={password} onChange={setPassword} hint="You will use this with your email to sign in." />
          <Button type="submit" loading={busy} className="w-full !min-h-11">Join the team <ArrowRight className="w-4 h-4" /></Button>
        </form>
      )}
    </AuthShell>
  );
}
