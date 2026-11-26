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

const TodayPage = lazy(() => import('../../actors/shared/TodayPage'));
const FuelsEnergyPage = lazy(() => import('../../actors/plant-manager/FuelsEnergyPage'));
const WaterWastePage = lazy(() => import('../../actors/plant-manager/WaterWastePage'));
const RefrigerantsAirMaterialsPage = lazy(() => import('../../actors/plant-manager/RefrigerantsAirMaterialsPage'));

const BoundaryFactorsPage = lazy(() => import('../../actors/sustainability-lead/BoundaryFactorsPage'));
const ThisMonthPage = lazy(() => import('../../actors/sustainability-lead/ThisMonthPage'));
const ReviewQueuePage = lazy(() => import('../../actors/sustainability-lead/ReviewQueuePage'));
const CloseMonthPage = lazy(() => import('../../actors/sustainability-lead/CloseMonthPage'));
const ExplorerPage = lazy(() => import('../../actors/sustainability-lead/ExplorerPage'));
const DocumentsPage = lazy(() => import('../../actors/shared/DocumentsPage'));
const NotificationsPage = lazy(() => import('../../actors/shared/NotificationsPage'));
const HelpPage = lazy(() => import('../../actors/shared/HelpPage'));
const TargetsMaccPage = lazy(() => import('../../actors/sustainability-lead/TargetsMaccPage'));
const ValueChainSuppliersPage = lazy(() => import('../../actors/sustainability-lead/ValueChainSuppliersPage'));
const GreenEconomyCctsPage = lazy(() => import('../../actors/sustainability-lead/GreenEconomyCctsPage'));
const ReportsExportsPage = lazy(() => import('../../actors/sustainability-lead/ReportsExportsPage'));


const ExecutiveSignOffPage = lazy(() => import('../../actors/executive-approver/ExecutiveSignOffPage'));
const RestatementsDecisionsPage = lazy(() => import('../../actors/executive-approver/RestatementsDecisionsPage'));



const TeamRbacUarPage = lazy(() => import('../../actors/org-admin/TeamRbacUarPage'));
const SecurityOutboxPage = lazy(() => import('../../actors/org-admin/SecurityOutboxPage'));
const WorkspaceSettingsPage = lazy(() => import('../../actors/org-admin/WorkspaceSettingsPage'));


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
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/sustainability/explorer" element={<ExplorerPage />} />

              <Route element={<RoleRoute allow={['PLANT_MANAGER', 'SUSTAINABILITY_LEAD', 'ORG_ADMIN']} />}>
                <Route path="/plant/dashboard" element={<TodayPage />} />
                <Route path="/plant/fuels-energy" element={<FuelsEnergyPage />} />
                <Route path="/plant/water-waste" element={<WaterWastePage />} />
                <Route path="/plant/air-materials" element={<RefrigerantsAirMaterialsPage />} />
              </Route>

              <Route element={<RoleRoute allow={['SUSTAINABILITY_LEAD', 'EXECUTIVE_APPROVER', 'ORG_ADMIN', 'PLANT_MANAGER']} />}>
                <Route path="/sustainability/dashboard" element={<TodayPage />} />
                <Route path="/sustainability/boundary" element={<BoundaryFactorsPage />} />
                <Route path="/sustainability/this-month" element={<ThisMonthPage />} />
                <Route path="/sustainability/review" element={<ReviewQueuePage />} />
                <Route path="/sustainability/close" element={<CloseMonthPage />} />
                <Route path="/sustainability/approvals" element={<Navigate to="/sustainability/review" replace />} />
                <Route path="/sustainability/targets" element={<TargetsMaccPage />} />
                <Route path="/sustainability/value-chain" element={<ValueChainSuppliersPage />} />
                <Route path="/sustainability/green-economy" element={<GreenEconomyCctsPage />} />
                <Route path="/sustainability/reports" element={<ReportsExportsPage />} />
              </Route>

              <Route element={<RoleRoute allow={['EXECUTIVE_APPROVER', 'ORG_ADMIN']} />}>
                <Route path="/executive/sign-off" element={<ExecutiveSignOffPage />} />
                <Route path="/executive/restatements" element={<RestatementsDecisionsPage />} />
              </Route>

              <Route element={<RoleRoute allow={['ORG_ADMIN', 'SUSTAINABILITY_LEAD']} />}>
                <Route path="/admin/team" element={<TeamRbacUarPage />} />
                <Route path="/admin/security" element={<SecurityOutboxPage />} />
                <Route path="/admin/settings" element={<WorkspaceSettingsPage />} />
              </Route>

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
