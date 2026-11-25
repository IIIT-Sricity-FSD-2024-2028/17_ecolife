import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { setToken } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useForm } from '../../hooks/useForm';
import { invitationAccepted, invitationLoaded, selectInvitation } from '../../store/slices/app/authSlice';
import { ACTOR_LABELS } from '../../app/navigation';
import { AuthShell } from '../../components/ui/AuthShell';
import { Button, Notice, TextField } from '../../components/ui';

export default function InviteAcceptPage() {
  const { token } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { refreshMe } = useAuth();
  const info = useSelector(selectInvitation);
  const f = useForm('inviteAccept', { fullName: '', password: '', err: '', busy: false });
  const { err, busy } = f.values;

  useEffect(() => {
    dispatch(invitationLoaded({ token })).unwrap().catch((e) => f.patch({ err: e.message || 'This invitation is no longer valid. Ask your administrator to send a new one.' }));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function accept(e) {
    e.preventDefault(); f.patch({ busy: true, err: '' });
    try {
      const res = await dispatch(invitationAccepted({ token, fullName: f.values.fullName, password: f.values.password })).unwrap();
      setToken(res.token); await refreshMe(); navigate('/', { replace: true });
    } catch (e2) { f.patch({ err: e2.message || 'We could not accept the invitation.', busy: false }); }
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
          <TextField label="Your full name" required placeholder="e.g. Rajesh Kulkarni" {...f.field('fullName')} />
          <TextField label="Create a password" type="password" required minLength={10} autoComplete="new-password" placeholder="At least 10 characters" hint="You will use this with your email to sign in." {...f.field('password')} />
          <Button type="submit" loading={busy} className="w-full !min-h-11">Join the team <ArrowRight className="w-4 h-4" /></Button>
        </form>
      )}
    </AuthShell>
  );
}
