import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardShell } from '../components/layout/DashboardShell';
import { AdminDashboardShell } from '../components/layout/AdminDashboardShell';
import { RequireOrgAuth } from '../components/shared/RequireOrgAuth';
import { RequireAdminAuth } from '../components/shared/RequireAdminAuth';
import { ORG_ROLES } from '../constants/roles';

// Loading spinner fallback for lazy-loaded route chunks
function RouteLoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '280px',
      padding: '2rem',
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '3px solid var(--color-border, #e5e7eb)',
        borderTopColor: 'var(--color-primary, #059669)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
}

// ---- Lazy-loaded Public Landing & Org Portal Pages ----
const LandingPage = lazy(() => import('../pages/public/LandingPage').then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('../pages/org/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterOrgPage = lazy(() => import('../pages/org/auth/RegisterOrgPage').then((m) => ({ default: m.RegisterOrgPage })));
const ForgotPasswordPage = lazy(() => import('../pages/org/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('../pages/org/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('../pages/org/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const HomeRedirect = lazy(() => import('../components/shared/HomeRedirect').then((m) => ({ default: m.HomeRedirect })));
const ProfilePage = lazy(() => import('../pages/org/shared/ProfilePage').then((m) => ({ default: m.ProfilePage })));

// ---- Lazy-loaded Contributor Pages ----
const ContributorDashboardPage = lazy(() => import('../pages/org/contributor/ContributorDashboardPage').then((m) => ({ default: m.ContributorDashboardPage })));
const DataSubmissionPage = lazy(() => import('../pages/org/contributor/DataSubmissionPage').then((m) => ({ default: m.DataSubmissionPage })));
const SubmissionHistoryPage = lazy(() => import('../pages/org/contributor/SubmissionHistoryPage').then((m) => ({ default: m.SubmissionHistoryPage })));
const AlertsResponsePage = lazy(() => import('../pages/org/contributor/AlertsResponsePage').then((m) => ({ default: m.AlertsResponsePage })));

// ---- Lazy-loaded Reviewer Pages ----
const ReviewerDashboardPage = lazy(() => import('../pages/org/reviewer/ReviewerDashboardPage').then((m) => ({ default: m.ReviewerDashboardPage })));
const SubmissionsQueuePage = lazy(() => import('../pages/org/reviewer/SubmissionsQueuePage').then((m) => ({ default: m.SubmissionsQueuePage })));
const EmissionsAnalysisPage = lazy(() => import('../pages/org/reviewer/EmissionsAnalysisPage').then((m) => ({ default: m.EmissionsAnalysisPage })));
const TargetsPage = lazy(() => import('../pages/org/reviewer/TargetsPage').then((m) => ({ default: m.TargetsPage })));
const ReviewerReportsPage = lazy(() => import('../pages/org/reviewer/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const AmendmentsPage = lazy(() => import('../pages/org/reviewer/AmendmentsPage').then((m) => ({ default: m.AmendmentsPage })));
const ReviewerAlertsPage = lazy(() => import('../pages/org/reviewer/AlertsPage').then((m) => ({ default: m.AlertsPage })));

// ---- Lazy-loaded Org Admin Pages ----
const OrgAdminDashboardPage = lazy(() => import('../pages/org/org-admin/OrgAdminDashboardPage').then((m) => ({ default: m.OrgAdminDashboardPage })));
const DepartmentsAndStaffPage = lazy(() => import('../pages/org/org-admin/DepartmentsAndStaffPage').then((m) => ({ default: m.DepartmentsAndStaffPage })));
const LocationsPage = lazy(() => import('../pages/org/org-admin/LocationsPage').then((m) => ({ default: m.LocationsPage })));
const BillingPage = lazy(() => import('../pages/org/org-admin/BillingPage').then((m) => ({ default: m.BillingPage })));
const AuditLogPage = lazy(() => import('../pages/org/org-admin/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));

// ---- Lazy-loaded Executive Pages ----
const ExecutiveDashboardPage = lazy(() => import('../pages/org/executive/ExecutiveDashboardPage').then((m) => ({ default: m.ExecutiveDashboardPage })));
const ReportApprovalPage = lazy(() => import('../pages/org/executive/ReportApprovalPage').then((m) => ({ default: m.ReportApprovalPage })));
const AmendmentApprovalPage = lazy(() => import('../pages/org/executive/AmendmentApprovalPage').then((m) => ({ default: m.AmendmentApprovalPage })));

// ---- Lazy-loaded Admin Portal Pages ----
const AdminLoginPage = lazy(() => import('../pages/admin/auth/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })));
const OrganizationsPage = lazy(() => import('../pages/admin/organizations/OrganizationsPage').then((m) => ({ default: m.OrganizationsPage })));
const AdminDashboardPage = lazy(() => import('../pages/admin/dashboard/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const ResourceGovernancePage = lazy(() => import('../pages/admin/resources/ResourceGovernancePage').then((m) => ({ default: m.ResourceGovernancePage })));
const RevenueManagementPage = lazy(() => import('../pages/admin/revenue/RevenueManagementPage').then((m) => ({ default: m.RevenueManagementPage })));
const AdminAuditLogPage = lazy(() => import('../pages/admin/audit-log/AdminAuditLogPage').then((m) => ({ default: m.AdminAuditLogPage })));
const AdminTeamPage = lazy(() => import('../pages/admin/admin-team/AdminTeamPage').then((m) => ({ default: m.AdminTeamPage })));
const SettingsPage = lazy(() => import('../pages/admin/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const { ORG_ADMIN, CONTRIBUTOR, REVIEWER, EXECUTIVE } = ORG_ROLES;

export function AppRouter() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* ---- Public landing & org portal: public ---- */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterOrgPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* ---- Org portal: authenticated ---- */}
        <Route element={<RequireOrgAuth />}>
          <Route element={<DashboardShell />}>
            <Route path="/dashboard" element={<HomeRedirect />} />

            <Route element={<RequireOrgAuth roles={[CONTRIBUTOR]} />}>
              <Route path="/contributor" element={<ContributorDashboardPage />} />
              <Route path="/contributor/submit" element={<DataSubmissionPage />} />
              <Route path="/contributor/history" element={<SubmissionHistoryPage />} />
              <Route path="/contributor/alerts" element={<AlertsResponsePage />} />
              <Route path="/contributor/profile" element={<ProfilePage />} />
            </Route>

            <Route element={<RequireOrgAuth roles={[REVIEWER]} />}>
              <Route path="/reviewer" element={<ReviewerDashboardPage />} />
              <Route path="/reviewer/submissions" element={<SubmissionsQueuePage />} />
              <Route path="/reviewer/emissions" element={<EmissionsAnalysisPage />} />
              <Route path="/reviewer/targets" element={<TargetsPage />} />
              <Route path="/reviewer/reports" element={<ReviewerReportsPage />} />
              <Route path="/reviewer/amendments" element={<AmendmentsPage />} />
              <Route path="/reviewer/alerts" element={<ReviewerAlertsPage />} />
              <Route path="/reviewer/profile" element={<ProfilePage />} />
            </Route>

            <Route element={<RequireOrgAuth roles={[ORG_ADMIN]} />}>
              <Route path="/org-admin" element={<OrgAdminDashboardPage />} />
              <Route path="/org-admin/people" element={<DepartmentsAndStaffPage />} />
              <Route path="/org-admin/locations" element={<LocationsPage />} />
              <Route path="/org-admin/alerts" element={<AlertsResponsePage />} />
              <Route path="/org-admin/billing" element={<BillingPage />} />
              <Route path="/org-admin/audit-log" element={<AuditLogPage />} />
              <Route path="/org-admin/profile" element={<ProfilePage />} />
            </Route>

            <Route element={<RequireOrgAuth roles={[EXECUTIVE]} />}>
              <Route path="/executive" element={<ExecutiveDashboardPage />} />
              <Route path="/executive/reports" element={<ReportApprovalPage />} />
              <Route path="/executive/amendments" element={<AmendmentApprovalPage />} />
              <Route path="/executive/profile" element={<ProfilePage />} />
            </Route>
          </Route>
        </Route>

        {/* ---- Admin portal ---- */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/forgot-password" element={<ForgotPasswordPage portal="admin" />} />
        <Route path="/admin/reset-password" element={<ResetPasswordPage portal="admin" />} />
        <Route element={<RequireAdminAuth />}>
          <Route element={<AdminDashboardShell />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/organizations" element={<OrganizationsPage />} />
            <Route path="/admin/resources" element={<ResourceGovernancePage />} />
            <Route path="/admin/revenue" element={<RevenueManagementPage />} />
            <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
            <Route path="/admin/profile" element={<ProfilePage variant="admin" />} />
            <Route element={<RequireAdminAuth roles={['SUPER_ADMIN']} />}>
              <Route path="/admin/admin-team" element={<AdminTeamPage />} />
            </Route>
            <Route path="/admin/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
