import React from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { forgotPasswordRequested, passwordReset } from '../../store/slices/app/authSlice';
import { AuthShell } from '../../components/ui/AuthShell';
import { Button, Notice, TextField } from '../../components/ui';

export default function ForgotPasswordPage() {
  const dispatch = useDispatch();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const f = useForm('forgotPassword', { email: '', token: params.get('token') || '', newPassword: '', step: params.get('token') ? 'reset' : 'request', info: '', devToken: '', error: '', busy: false });
  const { step, info, devToken, error, busy } = f.values;

  async function requestReset(e) {
    e.preventDefault(); f.patch({ busy: true, error: '' });
    try {
      const r = await dispatch(forgotPasswordRequested({ email: f.values.email })).unwrap();
      f.patch({ info: r.message || 'If that email is registered, we have sent reset instructions.', step: 'reset', busy: false, ...(r.devPreviewToken ? { devToken: r.devPreviewToken, token: r.devPreviewToken } : {}) });
    } catch (err) { f.patch({ error: err.message, busy: false }); }
  }
  async function submitReset(e) {
    e.preventDefault(); f.patch({ busy: true, error: '' });
    try {
      await dispatch(passwordReset({ token: f.values.token, newPassword: f.values.newPassword })).unwrap();
      pushToast('Password changed. Sign in with your new password.');
      navigate('/login');
    } catch (err) { f.patch({ error: err.message, busy: false }); }
  }

  return (
    <AuthShell title={step === 'request' ? 'Reset your password' : 'Choose a new password'}
      subtitle={step === 'request' ? 'Enter your work email and we will send you the steps.' : 'Enter the code from the email, then your new password.'}
      footer={<Link to="/login" className="font-medium text-brand-700 hover:underline">Back to sign in</Link>}>
      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
      {info && <Notice tone="ok" className="mb-4">{info}</Notice>}
      {devToken && <Notice tone="warn" className="mb-4">Development mode only: the reset code is filled in below. In normal use it arrives by email.</Notice>}
      {step === 'request' ? (
        <form onSubmit={requestReset} className="space-y-4">
          <TextField label="Work email" type="email" required placeholder="you@company.in" {...f.field('email')} />
          <Button type="submit" loading={busy} className="w-full !min-h-11">Send reset email</Button>
        </form>
      ) : (
        <form onSubmit={submitReset} className="space-y-4">
          <TextField label="Reset code" required placeholder="Paste the code from the email" {...f.field('token')} />
          <TextField label="New password" type="password" required minLength={10} autoComplete="new-password" placeholder="At least 10 characters" {...f.field('newPassword')} hint="Pick a password you do not use anywhere else." />
          <Button type="submit" loading={busy} className="w-full !min-h-11">Save new password</Button>
        </form>
      )}
    </AuthShell>
  );
}
