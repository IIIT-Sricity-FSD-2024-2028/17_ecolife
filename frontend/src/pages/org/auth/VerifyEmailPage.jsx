import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, LogIn } from 'lucide-react';
import { authService } from '../../../services/authService';
import { AuthLayout } from '../../../components/layout/AuthLayout';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../services/apiClient';
import { ORG_ROUTES } from '../../../constants/routes';

/**
 * Landing page for the link in the verification email. The token is single
 * use, so the request is guarded to run exactly once even when React
 * StrictMode mounts the effect twice in development.
 */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState(token ? 'verifying' : 'missing'); // verifying | success | error | missing
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authService
      .verifyEmail({ token })
      .then(() => setStatus('success'))
      .catch((err) => {
        setMessage(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
        setStatus('error');
      });
  }, [token]);

  const footer = (
    <p>
      <Link to={ORG_ROUTES.LOGIN} className="inline-icon"><ArrowLeft size={14} aria-hidden="true" /> Back to Sign In</Link>
    </p>
  );

  if (status === 'success') {
    return (
      <AuthLayout title="Email verified" subtitle="Your address is confirmed." footer={footer}>
        <p className="auth-notice" role="status">You can now sign in to your organization.</p>
        <Button size="lg" fullWidth icon={LogIn} onClick={() => navigate(ORG_ROUTES.LOGIN)}>Go to Sign In</Button>
      </AuthLayout>
    );
  }

  if (status === 'verifying') {
    return (
      <AuthLayout title="Verifying your email" subtitle="Just a moment…">
        <p className="auth-notice" role="status">Checking your link…</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Verification link not valid" footer={footer}>
      <p className="auth-notice auth-notice--error" role="alert">
        {status === 'missing'
          ? 'This link is missing its token. Please use the link from your verification email.'
          : message}
      </p>
      <p className="text-muted">Sign in with your password and choose "Resend verification link" to get a new one.</p>
    </AuthLayout>
  );
}
