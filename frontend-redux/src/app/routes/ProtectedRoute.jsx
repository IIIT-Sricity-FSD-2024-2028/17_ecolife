import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function ProtectedRoute() {
  const { user, booting } = useAuth();
  if (booting) return <div className="min-h-screen bg-page flex items-center justify-center text-xs text-text">Loading Tropos...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
