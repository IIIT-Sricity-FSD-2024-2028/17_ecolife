import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { ADMIN_ROUTES } from '../../constants/routes';

export function RequireAdminAuth() {
  const { isAuthenticated } = useAdminAuth();
  if (!isAuthenticated) return <Navigate to={ADMIN_ROUTES.LOGIN} replace />;
  return <Outlet />;
}
