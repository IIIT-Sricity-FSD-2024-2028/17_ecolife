import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useZodForm } from '../../../hooks/useZodForm';
import { KeyRound, ArrowLeft } from 'lucide-react';
import { authService } from '../../../services/authService';
import { resetPasswordSchema, resetWithCodeSchema } from '../../../schemas/formSchemas';
import { AuthLayout } from '../../../components/layout/AuthLayout';
import { FormField, PasswordInput, TextInput } from '../../../components/ui/FormField';
import { PasswordRules } from '../../../components/ui/PasswordRules';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../services/apiClient';
import { useConfirm } from '../../../components/shared/ConfirmProvider';
import { ORG_ROUTES, ADMIN_ROUTES } from '../../../constants/routes';

/** Demo mode: reset with the on-screen 6-digit code (see ForgotPasswordPage). */
function ResetWithCodeForm({ email, portal }) {
  const admin = portal === 'admin';
  const routes = admin ? ADMIN_ROUTES : ORG_ROUTES;
  const submitReset = admin ? authService.adminResetPassword : authService.resetPassword;
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [serverError, setServerError] = useState(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useZodForm(resetWithCodeSchema, { code: '', newPassword: '', confirmPassword: '' });
  const newPassword = watch('newPassword');
  const confirmPassword = watch('confirmPassword');
  const matchStatus = confirmPassword
    ? confirmPassword === newPassword
      ? { tone: 'success', text: 'Passwords match' }
      : { tone: 'error', text: 'Passwords do not match' }
    : undefined;

  const onSubmit = async (values) => {
    setServerError(null);
    const ok = await confirm({ title: 'Set this as your new password?', message: 'Your old password will stop working straight away and you will sign in again with the new one.', confirmLabel: 'Reset password', icon: KeyRound });
    if (!ok) return;
    try {
      await submitReset({ email, code: values.code, newPassword: values.newPassword });
      navigate(routes.LOGIN);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  return (
    <AuthLayout
      variant={admin ? 'admin' : undefined}
      title="Enter your reset code"
      subtitle={`Resetting the password for ${email}.`}
      footer={<p><Link to={routes.FORGOT_PASSWORD}>Get a new code</Link></p>}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="6-digit code" error={errors.code} required>
          <TextInput inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" error={errors.code} {...register('code')} />
        </FormField>
        <FormField label="New Password" error={errors.newPassword} required>
          <PasswordInput autoComplete="new-password" placeholder="Enter a new password" error={errors.newPassword} {...register('newPassword')} />
        </FormField>
        <PasswordRules value={newPassword} />
        <FormField label="Confirm Password" error={errors.confirmPassword} status={matchStatus} required>
          <PasswordInput autoComplete="new-password" placeholder="Re-enter your new password" error={errors.confirmPassword} {...register('confirmPassword')} />
        </FormField>
        {serverError && <p className="auth-error" role="alert">{serverError}</p>}
        <Button type="submit" size="lg" fullWidth icon={KeyRound} loading={isSubmitting}>Reset Password</Button>
      </form>
    </AuthLayout>
  );
}

export function ResetPasswordPage({ portal = 'org' }) {
  const admin = portal === 'admin';
  const routes = admin ? ADMIN_ROUTES : ORG_ROUTES;
  const submitReset = admin ? authService.adminResetPassword : authService.resetPassword;
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useZodForm(resetPasswordSchema, { newPassword: '', confirmPassword: '' });

  const newPassword = watch('newPassword');
  const confirmPassword = watch('confirmPassword');
  const matchStatus = confirmPassword
    ? confirmPassword === newPassword
      ? { tone: 'success', text: 'Passwords match' }
      : { tone: 'error', text: 'Passwords do not match' }
    : undefined;

  const onSubmit = async (values) => {
    setServerError(null);
    const ok = await confirm({ title: 'Set this as your new password?', message: 'Your old password will stop working straight away and you will sign in again with the new one.', confirmLabel: 'Reset password', icon: KeyRound });
    if (!ok) return;
    try {
      await submitReset({ token, newPassword: values.newPassword });
      navigate(routes.LOGIN);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  if (!token && email) return <ResetWithCodeForm email={email} portal={portal} />;

  if (!token) {
    return (
      <AuthLayout
        variant={admin ? 'admin' : undefined}
        title="Reset link not valid"
        footer={
          <>
            <p>
              <span className="text-muted">Link expired?</span>{' '}
              <Link to={routes.FORGOT_PASSWORD}>Request a new one</Link>
            </p>
            <p>
              <Link to={routes.LOGIN} className="inline-icon"><ArrowLeft size={14} aria-hidden="true" /> Back to Sign In</Link>
            </p>
          </>
        }
      >
        <p className="auth-notice auth-notice--error" role="alert">
          This reset link is missing its token. Please use the link from your reset email.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout variant={admin ? 'admin' : undefined} title="Set a new password" subtitle="Choose a strong password for your account.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="New Password" error={errors.newPassword} required>
          <PasswordInput autoComplete="new-password" placeholder="Enter a new password" error={errors.newPassword} {...register('newPassword')} />
        </FormField>
        <PasswordRules value={newPassword} />
        <FormField label="Confirm Password" error={errors.confirmPassword} status={matchStatus} required>
          <PasswordInput autoComplete="new-password" placeholder="Re-enter your new password" error={errors.confirmPassword} {...register('confirmPassword')} />
        </FormField>

        {serverError && (
          <p className="auth-error" role="alert">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth icon={KeyRound} loading={isSubmitting}>
          Reset Password
        </Button>
      </form>
    </AuthLayout>
  );
}
