import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function RoleRoute({ allow }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.isPlatformAdmin && allow.includes('PLATFORM_ADMIN')) return <Outlet />;
  const permitted = (user.roles || []).some((r) => allow.includes(r));
  if (!permitted) return <Navigate to="/403" replace />;
  return <Outlet />;
}
