import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useZodForm } from '../../../hooks/useZodForm';
import { LogIn, Building2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { loginSchema } from '../../../schemas/formSchemas';
import { AuthLayout } from '../../../components/layout/AuthLayout';
import { FormField, TextInput, PasswordInput } from '../../../components/ui/FormField';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../services/apiClient';
import { ORG_ROUTES } from '../../../constants/routes';
import { getHomePathForRole } from '../../../utils/permissions';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(loginSchema, { email: '', password: '', remember: false });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      const result = await login(values.email, values.password, values.remember);
      navigate(getHomePathForRole(result?.user?.role) ?? ORG_ROUTES.DASHBOARD);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
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

        <Button type="submit" size="lg" fullWidth icon={LogIn} loading={isSubmitting}>
          Sign In
        </Button>
      </form>
    </AuthLayout>
  );
}
