import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { publicInfoLoaded, registerRequested, selectPublicInfo } from '../../store/slices/app/authSlice';
import { getDefaultPathForUser } from '../../app/navigation';
import { AuthShell } from '../../components/ui/AuthShell';
import { Button, FormGrid, Notice, SelectField, TextField } from '../../components/ui';

export default function SignupPage() {
  const dispatch = useDispatch();
  const { loginSuccess } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const pub = useSelector(selectPublicInfo);
  const f = useForm('signup', { organizationName: '', industrySector: '', city: '', state: '', fullName: '', email: '', password: '', confirm: '', error: '', busy: false });
  const { error, busy } = f.values;
  const mismatch = f.values.confirm !== '' && f.values.password !== f.values.confirm;
  useEffect(() => { dispatch(publicInfoLoaded()); }, [dispatch]);

  async function handleSubmit(e) {
    e.preventDefault();
    f.patch({ error: '' });
    if (f.values.password !== f.values.confirm) { f.patch({ error: 'The two passwords are different. Type the same password in both boxes.' }); return; }
    f.patch({ busy: true });
    try {
      const { confirm, error: _e, busy: _b, ...body } = f.values;
      const res = await dispatch(registerRequested({ body })).unwrap();
      await loginSuccess(res.token, res.user, res.organization);
      pushToast('Your workspace is ready. We sent a verification email to confirm your address.');
      navigate(getDefaultPathForUser(res.user), { replace: true });
    } catch (err) {
      f.patch({ error: err.message || 'We could not create your account. Please check the details and try again.', busy: false });
    }
  }

  return (
    <AuthShell wide title="Start your free trial" subtitle={pub ? `${pub.trialDays} days free. No card needed.` : 'No card needed.'}
      footer={<>Already have an account? <Link to="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link></>}>
      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-sm font-semibold text-muted">Your company</h2>
        <FormGrid cols={2}>
          <TextField className="sm:col-span-2" label="Company name" required placeholder="e.g. Apex Precision Forgings Pvt Ltd" hint="Use the legal name as it appears on your GST registration." {...f.field('organizationName')} />
          <TextField label="Industry" required placeholder="e.g. Auto components" {...f.field('industrySector')} />
          <TextField label="City of your main plant" required placeholder="e.g. Pune" {...f.field('city')} />
          <SelectField label="State" required placeholder="Choose a state" options={(pub?.states || []).map((s) => ({ value: s, label: s }))} {...f.field('state')} />
        </FormGrid>
        <h2 className="text-sm font-semibold text-muted pt-2">You</h2>
        <FormGrid cols={2}>
          <TextField label="Your full name" required placeholder="e.g. Priya Deshmukh" {...f.field('fullName')} />
          <TextField label="Work email" type="email" required autoComplete="username" placeholder="you@company.in" hint="You will use this to sign in." {...f.field('email')} />
          <TextField label="Password" type="password" required minLength={10} autoComplete="new-password" placeholder="At least 10 characters" hint="Use a mix of letters and numbers." {...f.field('password')} />
          <TextField label="Type the password again" type="password" required minLength={10} autoComplete="new-password" placeholder="Same password" error={mismatch ? 'This does not match the password above.' : undefined} {...f.field('confirm')} />
        </FormGrid>
        <Button type="submit" loading={busy} className="w-full !min-h-11">Create my workspace <ArrowRight className="w-4 h-4" /></Button>
        <p className="text-xs text-muted">By creating an account you agree to the <Link to="/terms" className="underline">Terms of use</Link> and <Link to="/privacy" className="underline">Privacy policy</Link>.</p>
      </form>
    </AuthShell>
  );
}
