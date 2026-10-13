import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Building2, Layers, CircleDollarSign, ScrollText, ShieldCheck, Settings, UserCircle } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { adminProfileService } from '../../services/profileService';
import { ADMIN_ROUTES } from '../../constants/routes';
import { PLATFORM_ROLE_LABELS } from '../../constants/roles';
import './layout.css';

const ADMIN_NAV_ITEMS = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'Organizations', path: '/admin/organizations', icon: Building2 },
  { label: 'Resource Governance', path: '/admin/resources', icon: Layers },
  { label: 'Revenue', path: '/admin/revenue', icon: CircleDollarSign },
  { label: 'Audit Log', path: '/admin/audit-log', icon: ScrollText },
  { label: 'Admin Team', path: '/admin/admin-team', icon: ShieldCheck },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
  { label: 'Profile', path: '/admin/profile', icon: UserCircle },
];

export function AdminDashboardShell() {
  const { admin, logout } = useAdminAuth();
  const roleLabel = PLATFORM_ROLE_LABELS[admin?.role] || '';
  const { data: profile } = useQuery({ queryKey: ['admin-me'], queryFn: adminProfileService.get });

  return (
    <div className="dashboard-shell">
      <Sidebar items={ADMIN_NAV_ITEMS} roleLabel={roleLabel} homePath={ADMIN_ROUTES.DASHBOARD} tag="Admin" />
      <div className="dashboard-shell__main">
        <Topbar
          portal="admin"
          navItems={ADMIN_NAV_ITEMS}
          displayName={profile?.fullName}
          email={admin?.email}
          roleLabel={roleLabel}
          profilePath={ADMIN_ROUTES.PROFILE}
          onLogout={logout}
        />
        <main className="dashboard-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
