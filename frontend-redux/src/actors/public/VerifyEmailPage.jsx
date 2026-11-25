import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useForm } from '../../hooks/useForm';
import { emailVerified } from '../../store/slices/app/authSlice';
import { AuthShell } from '../../components/ui/AuthShell';
import { Button, Notice, TextField } from '../../components/ui';

export default function VerifyEmailPage() {
  const dispatch = useDispatch();
  const [params] = useSearchParams();
  const f = useForm('verifyEmail', { token: params.get('token') || '', verified: false, error: '', busy: false });
  const { verified, error, busy } = f.values;

  async function verify(tok) {
    if (!tok) return;
    f.patch({ busy: true, error: '' });
    try { await dispatch(emailVerified({ token: tok })).unwrap(); f.patch({ verified: true, busy: false }); }
    catch (err) { f.patch({ error: err.message || 'We could not verify this code. It may have expired. Ask for a new email from your account page.', busy: false }); }
  }
  useEffect(() => { const t = params.get('token'); if (t) verify(t); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthShell title="Confirm your email address" subtitle="This tells us the address is really yours.">
      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
      {verified ? (
        <div className="card p-6 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-ok-600 mx-auto" />
          <div className="font-semibold">Your email is confirmed</div>
          <Link to="/login" className="btn-primary inline-flex">Continue to sign in</Link>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); verify(f.values.token); }} className="space-y-4">
          <TextField label="Verification code" required placeholder="Paste the code from the email" {...f.field('token')} />
          <Button type="submit" loading={busy} className="w-full !min-h-11">Confirm email</Button>
        </form>
      )}
    </AuthShell>
  );
}
