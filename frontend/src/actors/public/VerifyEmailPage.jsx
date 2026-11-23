import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { AuthShell } from '../../components/ui/AuthShell';
import { Button, Notice, TextField } from '../../components/ui';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function verify(tok) {
    if (!tok) return;
    setBusy(true); setError('');
    try { await apiFetch('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: tok.trim() }) }); setVerified(true); }
    catch (err) { setError(err.message || 'We could not verify this code. It may have expired. Ask for a new email from your account page.'); }
    finally { setBusy(false); }
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
        <form onSubmit={(e) => { e.preventDefault(); verify(token); }} className="space-y-4">
          <TextField label="Verification code" required placeholder="Paste the code from the email" value={token} onChange={setToken} />
          <Button type="submit" loading={busy} className="w-full !min-h-11">Confirm email</Button>
        </form>
      )}
    </AuthShell>
  );
}
