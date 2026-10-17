import { useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '../../context/AuthContext';
import { AnnouncementsBanner } from '../shared/AnnouncementsBanner';
import { profileService } from '../../services/profileService';
import { getNavItemsForRole, getHomePathForRole, getProfilePathForRole } from '../../utils/permissions';
import { ORG_ROLE_LABELS } from '../../constants/roles';
import './layout.css';

/**
 * The single shared shell every org-portal page renders inside — this is
 * the direct replacement for the old application's per-page
 * `injectLayout()` string-rebuild. Nav items are derived from the current
 * user's role and passed down to Sidebar as a prop.
 */
export function DashboardShell() {
  const { user, logout } = useAuth();
  const navItems = useMemo(() => getNavItemsForRole(user?.role), [user?.role]);
  const roleLabel = ORG_ROLE_LABELS[user?.role] || '';
  const homePath = getHomePathForRole(user?.role);
  // Same query key as the Profile page, so the name is shared and cached.
  const { data: profile } = useQuery({ queryKey: ['me'], queryFn: profileService.get });

  return (
    <div className="dashboard-shell">
      <Sidebar items={navItems} roleLabel={roleLabel} homePath={homePath} />
      <div className="dashboard-shell__main">
        <Topbar
          portal="org"
          role={user?.role}
          navItems={navItems}
          displayName={profile?.fullName || user?.fullName}
          email={profile?.email || user?.email}
          roleLabel={roleLabel}
          profilePath={getProfilePathForRole(user?.role)}
          onLogout={logout}
        />
        <main className="dashboard-shell__content">
          <AnnouncementsBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
