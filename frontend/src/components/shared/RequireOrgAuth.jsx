import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ORG_ROUTES } from '../../constants/routes';
import { getHomePathForRole } from '../../utils/permissions';

/** Redirects to login if not authenticated; optionally restricts to a set
 * of roles (the real enforcement is still the backend's — this is UX). */
export function RequireOrgAuth({ roles }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to={ORG_ROUTES.LOGIN} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={getHomePathForRole(user.role)} replace />;

  return <Outlet />;
}
