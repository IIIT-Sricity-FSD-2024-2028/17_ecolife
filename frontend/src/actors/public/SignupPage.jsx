import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { getDefaultPathForUser } from '../../config/actorNavigation';
import { AuthShell } from '../../components/ui/AuthShell';
import { Button, FormGrid, Notice, SelectField, TextField } from '../../components/ui';

export default function SignupPage() {
  const { loginSuccess } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const { data: pub } = useApi('/meta/public');
  const [f, setF] = useState({ organizationName: '', industrySector: '', city: '', state: '', fullName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const mismatch = f.confirm !== '' && f.password !== f.confirm;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (f.password !== f.confirm) { setError('The two passwords are different. Type the same password in both boxes.'); return; }
    setBusy(true);
    try {
      const { confirm, ...body } = f;
      const res = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) });
      loginSuccess(res.token, res.user, res.organization);
      pushToast('Your workspace is ready. We sent a verification email to confirm your address.');
      navigate(getDefaultPathForUser(res.user), { replace: true });
    } catch (err) {
      setError(err.message || 'We could not create your account. Please check the details and try again.');
    } finally { setBusy(false); }
  }

  return (
    <AuthShell wide title="Start your free trial" subtitle={pub ? `${pub.trialDays} days free. No card needed.` : 'No card needed.'}
      footer={<>Already have an account? <Link to="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link></>}>
      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-sm font-semibold text-muted">Your company</h2>
        <FormGrid cols={2}>
          <TextField className="sm:col-span-2" label="Company name" required placeholder="e.g. Apex Precision Forgings Pvt Ltd" hint="Use the legal name as it appears on your GST registration." value={f.organizationName} onChange={set('organizationName')} />
          <TextField label="Industry" required placeholder="e.g. Auto components" value={f.industrySector} onChange={set('industrySector')} />
          <TextField label="City of your main plant" required placeholder="e.g. Pune" value={f.city} onChange={set('city')} />
          <SelectField label="State" required value={f.state} onChange={set('state')} placeholder="Choose a state" options={(pub?.states || []).map((s) => ({ value: s, label: s }))} />
        </FormGrid>
        <h2 className="text-sm font-semibold text-muted pt-2">You</h2>
        <FormGrid cols={2}>
          <TextField label="Your full name" required placeholder="e.g. Priya Deshmukh" value={f.fullName} onChange={set('fullName')} />
          <TextField label="Work email" type="email" required autoComplete="username" placeholder="you@company.in" value={f.email} onChange={set('email')} hint="You will use this to sign in." />
          <TextField label="Password" type="password" required minLength={10} autoComplete="new-password" placeholder="At least 10 characters" value={f.password} onChange={set('password')} hint="Use a mix of letters and numbers." />
          <TextField label="Type the password again" type="password" required minLength={10} autoComplete="new-password" placeholder="Same password" value={f.confirm} onChange={set('confirm')} error={mismatch ? 'This does not match the password above.' : undefined} />
        </FormGrid>
        <Button type="submit" loading={busy} className="w-full !min-h-11">Create my workspace <ArrowRight className="w-4 h-4" /></Button>
        <p className="text-xs text-muted">By creating an account you agree to the <Link to="/terms" className="underline">Terms of use</Link> and <Link to="/privacy" className="underline">Privacy policy</Link>.</p>
      </form>
    </AuthShell>
  );
}
