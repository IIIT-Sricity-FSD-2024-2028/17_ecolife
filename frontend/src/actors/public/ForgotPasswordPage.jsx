import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import { AuthShell } from '../../components/ui/AuthShell';
import { Button, Notice, TextField } from '../../components/ui';

export default function ForgotPasswordPage() {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(params.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(params.get('token') ? 'reset' : 'request');
  const [info, setInfo] = useState('');
  const [devToken, setDevToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestReset(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setInfo(r.message || 'If that email is registered, we have sent reset instructions.');
      if (r.devPreviewToken) { setDevToken(r.devPreviewToken); setToken(r.devPreviewToken); }
      setStep('reset');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function submitReset(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: token.trim(), newPassword }) });
      pushToast('Password changed. Sign in with your new password.');
      navigate('/login');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
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
          <TextField label="Work email" type="email" required placeholder="you@company.in" value={email} onChange={setEmail} />
          <Button type="submit" loading={busy} className="w-full !min-h-11">Send reset email</Button>
        </form>
      ) : (
        <form onSubmit={submitReset} className="space-y-4">
          <TextField label="Reset code" required placeholder="Paste the code from the email" value={token} onChange={setToken} />
          <TextField label="New password" type="password" required minLength={10} autoComplete="new-password" placeholder="At least 10 characters" value={newPassword} onChange={setNewPassword} hint="Pick a password you do not use anywhere else." />
          <Button type="submit" loading={busy} className="w-full !min-h-11">Save new password</Button>
        </form>
      )}
    </AuthShell>
  );
}
