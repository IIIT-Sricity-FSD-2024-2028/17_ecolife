import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDefaultPathForUser } from '../navigation';
import { PublicLayout } from '../layouts/PublicLayout';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';

const LegalPage = lazy(() => import('../../actors/public/LegalPage'));
const LandingPage = lazy(() => import('../../actors/public/LandingPage'));
const LoginPage = lazy(() => import('../../actors/public/LoginPage'));
const SignupPage = lazy(() => import('../../actors/public/SignupPage'));
const ForgotPasswordPage = lazy(() => import('../../actors/public/ForgotPasswordPage'));
const VerifyEmailPage = lazy(() => import('../../actors/public/VerifyEmailPage'));
const InviteAcceptPage = lazy(() => import('../../actors/public/InviteAcceptPage'));
const ProfileSecurityPage = lazy(() => import('../../actors/shared/ProfileSecurityPage'));
const NotFoundPage = lazy(() => import('../../actors/public/NotFoundPage'));
const ForbiddenPage = lazy(() => import('../../actors/public/ForbiddenPage'));
const SetupGuidePage = lazy(() => import('../../actors/shared/SetupGuidePage'));
const SearchResultsPage = lazy(() => import('../../actors/shared/SearchResultsPage'));


const NotificationsPage = lazy(() => import('../../actors/shared/NotificationsPage'));
const HelpPage = lazy(() => import('../../actors/shared/HelpPage'));







function RootEntry() {
  const { user, booting } = useAuth();
  if (booting) return <div className="min-h-screen bg-page flex items-center justify-center text-xs text-text">Loading Tropos...</div>;
  if (user) return <Navigate to={getDefaultPathForUser(user)} replace />;
  return <LandingPage />;
}

function PageLoader() {
  return <div className="glass-card p-8 text-center text-xs text-muted">Loading module...</div>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Landing, Auth & Zero-Account External Portals */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<RootEntry />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/invite/:token" element={<InviteAcceptPage />} />
            <Route path="/terms" element={<LegalPage kind="terms" />} />
            <Route path="/privacy" element={<LegalPage kind="privacy" />} />
            <Route path="/403" element={<ForbiddenPage />} />
          </Route>

          {/* Authenticated Actor Workspaces */}
          <Route element={<ProtectedRoute />}>
            <Route element={<WorkspaceLayout />}>
              <Route path="/profile" element={<ProfileSecurityPage />} />
              <Route path="/setup" element={<SetupGuidePage />} />
              <Route path="/search" element={<SearchResultsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/help" element={<HelpPage />} />

            </Route>
          </Route>

          <Route element={<PublicLayout />}>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
