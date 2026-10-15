import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useZodForm } from '../../../hooks/useZodForm';
import { LogIn } from 'lucide-react';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { loginSchema } from '../../../schemas/formSchemas';
import { AuthLayout } from '../../../components/layout/AuthLayout';
import { FormField, TextInput, PasswordInput } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../services/apiClient';
import { ADMIN_ROUTES } from '../../../constants/routes';

export function AdminLoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(loginSchema, { email: '', password: '' });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      navigate(ADMIN_ROUTES.DASHBOARD);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <AuthLayout variant="admin" title="Tropos Admin Portal" subtitle="Sign in with your platform admin account">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Email Address" error={errors.email} required>
          <TextInput type="email" autoComplete="email" placeholder="admin@company.com" error={errors.email} {...register('email')} />
        </FormField>
        <FormField label="Password" error={errors.password} required>
          <PasswordInput autoComplete="current-password" placeholder="Enter your password" error={errors.password} {...register('password')} />
        </FormField>

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

