import React from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useForm } from '../../hooks/useForm';
import { loginRequested } from '../../store/slices/app/authSlice';
import { getDefaultPathForUser } from '../../app/navigation';
import { AuthShell } from '../../components/ui/AuthShell';
import { Button, Notice, TextField } from '../../components/ui';

export default function LoginPage() {
  const dispatch = useDispatch();
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();
  const f = useForm('login', { email: '', password: '', totpCode: '', needs2fa: false, error: '', busy: false });
  const { email, password, totpCode, needs2fa, error, busy } = f.values;

  async function handleSubmit(e) {
    e.preventDefault();
    f.patch({ error: '', busy: true });
    try {
      const res = await dispatch(loginRequested({ email, password, totpCode })).unwrap();
      if (res.requires2fa) { f.patch({ needs2fa: true, busy: false }); return; }
      await loginSuccess(res.token, res.user, res.organization);
      navigate(getDefaultPathForUser(res.user), { replace: true });
    } catch (err) {
      f.patch({ error: err.message || 'We could not sign you in. Check your email and password and try again.', busy: false });
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Use the work email your administrator invited."
      footer={<>New company? <Link to="/signup" className="font-medium text-brand-700 hover:underline">Start a free trial</Link></>}>
      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Work email" type="email" required autoComplete="username" placeholder="you@company.in" {...f.field('email')} />
        <div>
          <TextField label="Password" type="password" required autoComplete="current-password" placeholder="Your password" {...f.field('password')} />
          <div className="mt-1.5 text-right"><Link to="/forgot-password" className="text-sm text-brand-700 hover:underline">Forgot your password?</Link></div>
        </div>
        {needs2fa && (
          <TextField label="Authenticator code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" {...f.field('totpCode')}
            hint="Open your authenticator app and enter the current code. You can also use one of your recovery codes." />
        )}
        <Button type="submit" loading={busy} className="w-full !min-h-11">{needs2fa ? 'Verify and sign in' : 'Sign in'} <ArrowRight className="w-4 h-4" /></Button>
      </form>
      {needs2fa && <p className="mt-3 text-sm text-muted flex items-center gap-1.5"><KeyRound className="w-4 h-4" /> Two-step sign-in is on for this account.</p>}
    </AuthShell>
  );
}
