import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { ADMIN_ROUTES } from '../../constants/routes';

export function RequireAdminAuth({ roles }) {
  const { isAuthenticated, admin } = useAdminAuth();
  if (!isAuthenticated) return <Navigate to={ADMIN_ROUTES.LOGIN} replace />;
  if (roles && !roles.includes(admin?.role)) return <Navigate to={ADMIN_ROUTES.DASHBOARD} replace />;
  return <Outlet />;
}
