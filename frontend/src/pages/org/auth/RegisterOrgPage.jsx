import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useZodForm } from '../../../hooks/useZodForm';
import { ArrowRight, ArrowLeft, Building2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { registerOrgSchema } from '../../../schemas/formSchemas';
import { AuthLayout } from '../../../components/layout/AuthLayout';
import { FormField, TextInput, PasswordInput } from '../../../components/ui/FormField';
import { PasswordRules } from '../../../components/ui/PasswordRules';
import { Button } from '../../../components/ui/Button';
import { ApiError, setSessionNotice } from '../../../services/apiClient';
import { ORG_ROUTES } from '../../../constants/routes';

export function RegisterOrgPage() {
  const { registerOrganization } = useAuth();
  const [serverError, setServerError] = useState(null);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    trigger,
    formState: { errors, isSubmitting },
  } = useZodForm(registerOrgSchema, { organizationName: '', fullName: '', email: '', password: '', confirmPassword: '' });

  // Live feedback while the user types the confirmation.
  const password = watch('password');
  const confirmPassword = watch('confirmPassword');
  const matchStatus = confirmPassword
    ? confirmPassword === password
      ? { tone: 'success', text: 'Passwords match' }
      : { tone: 'error', text: 'Passwords do not match' }
    : undefined;

  const goToPasswordStep = async () => {
    const ok = await trigger(['organizationName', 'fullName', 'email']);
    if (ok) {
      setServerError(null);
      setStep(2);
    }
  };

  const onSubmit = async (values) => {
    setServerError(null);
    // confirmPassword is a form-only field; the API rejects unknown properties.
    const { confirmPassword: _confirm, ...payload } = values;
    try {
      await registerOrganization(payload);
      setSessionNotice('Your organization account was created. You can now sign in.');
      navigate(ORG_ROUTES.LOGIN, { replace: true });
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setServerError('Something went wrong. Please try again.');
        return;
      }
      // Work-email and duplicate-email rejections belong on the email field.
      const emailError = err.fieldErrors?.find((e) => e.field === 'email');
      if (emailError) {
        setStep(1);
        setError('email', { type: 'server', message: emailError.message }, { shouldFocus: true });
      } else {
        setServerError(err.message);
      }
    }
  };

  return (
    <AuthLayout
      title="Register your organization"
      subtitle="Set up your workspace."
      footer={
        <p>
          <span className="text-muted">Already have an account?</span> <Link to={ORG_ROUTES.LOGIN}>Sign In</Link>
        </p>
      }
    >
      <div className="auth-progress">
        <p className="auth-progress__label">
          <span className="auth-progress__count">Step {step} of 2</span>
          <span aria-hidden="true"> · </span>
          {step === 1 ? 'Tell us about your organization' : 'Create a secure password'}
        </p>
        <div
          className="auth-progress__bars"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={2}
          aria-valuenow={step}
          aria-label={`Step ${step} of 2`}
        >
          <span className="auth-progress__bar is-filled" />
          <span className={`auth-progress__bar${step === 2 ? ' is-filled' : ''}`} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          // Enter on step 1 should advance, not submit a half-filled form.
          if (step === 1) {
            e.preventDefault();
            goToPasswordStep();
            return;
          }
          handleSubmit(onSubmit)(e);
        }}
        noValidate
      >
        <div hidden={step !== 1}>
          <FormField label="Organization Name" error={errors.organizationName} required>
            <TextInput placeholder="e.g. Acme Industries" error={errors.organizationName} {...register('organizationName')} />
          </FormField>

          <FormField label="Full Name" error={errors.fullName} required>
            <TextInput autoComplete="name" placeholder="Enter your full name" error={errors.fullName} {...register('fullName')} />
          </FormField>

          <FormField label="Email Address" error={errors.email} required>
            <TextInput type="email" autoComplete="email" placeholder="you@company.com" error={errors.email} {...register('email')} />
          </FormField>

          <Button size="lg" fullWidth onClick={goToPasswordStep}>
            Continue <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </div>

        <div hidden={step !== 2}>
          <FormField label="Password" error={errors.password} required>
            <PasswordInput autoComplete="new-password" placeholder="Create a password" error={errors.password} {...register('password')} />
          </FormField>
          <PasswordRules value={password} />

          <FormField label="Confirm Password" error={errors.confirmPassword} status={matchStatus} required>
            <PasswordInput
              autoComplete="new-password"
              placeholder="Re-enter your password"
              error={errors.confirmPassword}
              {...register('confirmPassword')}
            />
          </FormField>

          {serverError && (
            <p className="auth-error" role="alert">
              {serverError}
            </p>
          )}

          <div className="auth-actions">
            <Button variant="secondary" size="lg" icon={ArrowLeft} onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="submit" size="lg" fullWidth icon={Building2} loading={isSubmitting}>
              Register Organization
            </Button>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}
