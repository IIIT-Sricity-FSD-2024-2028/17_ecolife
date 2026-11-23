import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { getDefaultPathForUser } from '../../config/actorNavigation';
import { AuthShell } from '../../components/ui/AuthShell';
import { Button, Notice, TextField } from '../../components/ui';

export default function LoginPage() {
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, totpCode: totpCode || undefined }) });
      if (res.requires2fa) { setNeeds2fa(true); return; }
      loginSuccess(res.token, res.user, res.organization);
      navigate(getDefaultPathForUser(res.user), { replace: true });
    } catch (err) {
      setError(err.message || 'We could not sign you in. Check your email and password and try again.');
    } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Sign in" subtitle="Use the work email your administrator invited."
      footer={<>New company? <Link to="/signup" className="font-medium text-brand-700 hover:underline">Start a free trial</Link></>}>
      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Work email" type="email" required autoComplete="username" placeholder="you@company.in" value={email} onChange={setEmail} />
        <div>
          <TextField label="Password" type="password" required autoComplete="current-password" placeholder="Your password" value={password} onChange={setPassword} />
          <div className="mt-1.5 text-right"><Link to="/forgot-password" className="text-sm text-brand-700 hover:underline">Forgot your password?</Link></div>
        </div>
        {needs2fa && (
          <TextField label="Authenticator code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={totpCode} onChange={setTotpCode}
            hint="Open your authenticator app and enter the current code. You can also use one of your recovery codes." />
        )}
        <Button type="submit" loading={busy} className="w-full !min-h-11">{needs2fa ? 'Verify and sign in' : 'Sign in'} <ArrowRight className="w-4 h-4" /></Button>
      </form>
      {needs2fa && <p className="mt-3 text-sm text-muted flex items-center gap-1.5"><KeyRound className="w-4 h-4" /> Two-step sign-in is on for this account.</p>}
    </AuthShell>
  );
}
