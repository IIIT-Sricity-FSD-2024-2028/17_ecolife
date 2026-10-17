import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useZodForm } from '../../../hooks/useZodForm';
import { LogIn, Building2, Wrench } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { loginSchema } from '../../../schemas/formSchemas';
import { AuthLayout } from '../../../components/layout/AuthLayout';
import { FormField, TextInput, PasswordInput } from '../../../components/ui/FormField';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Button } from '../../../components/ui/Button';
import { ApiError, consumeSessionNotice } from '../../../services/apiClient';
import { authService } from '../../../services/authService';
import { ORG_ROUTES } from '../../../constants/routes';
import { getHomePathForRole } from '../../../utils/permissions';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);
  const [sessionNotice] = useState(() => consumeSessionNotice());
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [resendState, setResendState] = useState('idle'); // idle | sending | sent | failed
  const [maintenance, setMaintenance] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(loginSchema, { email: '', password: '', remember: false });

  useEffect(() => {
    let mounted = true;
    authService
      .getMaintenanceStatus()
      .then((res) => {
        if (mounted && res?.maintenanceMode) {
          setMaintenance(res);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (values) => {
    setServerError(null);
    setUnverifiedEmail(null);
    setResendState('idle');
    if (maintenance?.maintenanceMode) {
      setServerError(
        maintenance.message ||
          'Tropos is currently undergoing scheduled platform maintenance. Organization sign-in is temporarily unavailable. Please try again shortly.',
      );
      return;
    }
    try {
      const result = await login(values.email, values.password, values.remember);
      navigate(getHomePathForRole(result?.user?.role) ?? ORG_ROUTES.DASHBOARD);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.some((e) => e.field === 'email_not_verified')) {
        setUnverifiedEmail(values.email);
      }
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const resendVerification = async () => {
    setResendState('sending');
    try {
      await authService.resendVerification({ email: unverifiedEmail });
      setResendState('sent');
    } catch {
      setResendState('failed');
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your account to continue"
      footer={
        <p>
          <span className="text-muted">Need a new organization?</span>{' '}
          <Link to={ORG_ROUTES.REGISTER} className="inline-icon"><Building2 size={14} aria-hidden="true" /> Register Organization</Link>
        </p>
      }
    >
      {sessionNotice && <p className="auth-notice" role="status">{sessionNotice}</p>}
      {maintenance?.maintenanceMode && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md, 8px)',
            backgroundColor: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid var(--color-warning, #eab308)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <Wrench size={18} style={{ color: 'var(--color-warning, #eab308)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ display: 'block', fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
              System Maintenance Active
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {maintenance.message || 'Tropos is currently undergoing scheduled platform maintenance. Organization logins are temporarily disabled.'}
            </p>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Email Address" error={errors.email} required>
          <TextInput type="email" autoComplete="email" placeholder="you@company.com" error={errors.email} {...register('email')} />
        </FormField>

        <FormField label="Password" error={errors.password} required>
          <PasswordInput autoComplete="current-password" placeholder="Enter your password" error={errors.password} {...register('password')} />
        </FormField>

        <div className="auth-row">
          <Checkbox label="Remember me" {...register('remember')} />
          <Link to={ORG_ROUTES.FORGOT_PASSWORD}>Forgot password?</Link>
        </div>

        {serverError && (
          <p className="auth-error" role="alert">
            {serverError}
          </p>
        )}

        {unverifiedEmail && (
          <p className="auth-notice" role="status">
            {resendState === 'sent' ? (
              'A new verification link has been sent. Check your inbox.'
            ) : (
              <>
                Didn't get the email?{' '}
                <button type="button" className="link-button" onClick={resendVerification} disabled={resendState === 'sending'}>
                  {resendState === 'sending' ? 'Sending…' : 'Resend verification link'}
                </button>
                {resendState === 'failed' && ' Could not send it. Please try again shortly.'}
              </>
            )}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          fullWidth
          icon={LogIn}
          loading={isSubmitting}
          disabled={!!maintenance?.maintenanceMode}
        >
          {maintenance?.maintenanceMode ? 'Maintenance Mode Active' : 'Sign In'}
        </Button>
      </form>
    </AuthLayout>
  );
}
