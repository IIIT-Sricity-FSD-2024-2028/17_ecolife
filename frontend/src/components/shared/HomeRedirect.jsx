import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getHomePathForRole } from '../../utils/permissions';

/** "/" sends each signed-in role to its own dashboard. */
export function HomeRedirect() {
  const { user } = useAuth();
  const home = getHomePathForRole(user?.role);
  return <Navigate to={home === '/' ? '/login' : home} replace />;
}
