import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useZodForm } from '../../../hooks/useZodForm';
import { Send, MailCheck, ArrowLeft } from 'lucide-react';
import { authService } from '../../../services/authService';
import { forgotPasswordSchema } from '../../../schemas/formSchemas';
import { AuthLayout } from '../../../components/layout/AuthLayout';
import { FormField, TextInput } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/Button';
import { ORG_ROUTES, ADMIN_ROUTES } from '../../../constants/routes';

export function ForgotPasswordPage({ portal = 'org' }) {
  const admin = portal === 'admin';
  const routes = admin ? ADMIN_ROUTES : ORG_ROUTES;
  const requestReset = admin ? authService.adminForgotPassword : authService.forgotPassword;
  const [submitted, setSubmitted] = useState(false);
  const [demo, setDemo] = useState(null); // { email, code } when the server runs in demo-code mode
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(forgotPasswordSchema, { email: '' });

  const onSubmit = async (values) => {
    const result = await requestReset(values);
    if (result?.demoCode) {
      setDemo({ email: values.email, code: result.demoCode, minutes: result.expiresInMinutes });
      return;
    }
    setSubmitted(true);
  };

  return (
    <AuthLayout
      variant={admin ? 'admin' : undefined}
      title="Forgot your password?"
      subtitle={submitted ? undefined : "Enter your email address and we'll send you a reset link."}
      footer={
        <p>
          <span className="text-muted">Remembered your password?</span> <Link to={routes.LOGIN} className="inline-icon"><ArrowLeft size={14} aria-hidden="true" /> Sign In</Link>
        </p>
      }
    >
      {demo ? (
        <div>
          <p className="auth-notice auth-notice--success" role="status">
            <strong>Demo mode:</strong> no email service is connected, so your reset code is shown here instead.
          </p>
          <p style={{ fontSize: '2rem', letterSpacing: '0.4em', textAlign: 'center', fontWeight: 700, margin: '16px 0' }} aria-label="Reset code">
            {demo.code}
          </p>
          <p className="text-muted" style={{ textAlign: 'center', marginBottom: 16 }}>
            Valid for {demo.minutes} minutes. Unknown email addresses are shown a code too, but it will not work.
          </p>
          <Button size="lg" fullWidth icon={Send} onClick={() => navigate(`${routes.RESET_PASSWORD}?email=${encodeURIComponent(demo.email)}`)}>
            Continue
          </Button>
        </div>
      ) : submitted ? (
        <p className="auth-notice auth-notice--success" role="status">
          <MailCheck size={16} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8 }} />
          If an account with that email exists, a reset link has been sent.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Email Address" error={errors.email} required>
            <TextInput type="email" autoComplete="email" placeholder="you@company.com" error={errors.email} {...register('email')} />
          </FormField>
          <Button type="submit" size="lg" fullWidth icon={Send} loading={isSubmitting}>
            Send Reset Link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
