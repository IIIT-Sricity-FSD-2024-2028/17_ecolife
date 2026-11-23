import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X, UserRound, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ACTOR_LABELS, getNavItemsForUser, pageTitleFor } from '../config/actorNavigation';
import { TroposLogo } from '../components/common/TroposLogo';
import { SetupBanner } from '../components/common/SetupBanner';
import { GlobalSearchBar } from '../components/common/GlobalSearchBar';
import { NotificationDrawer } from '../components/common/NotificationDrawer';

function SidebarNav({ items, onNavigate }) {
  // keep items in their given order, printing a heading whenever the group changes
  let last = null;
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" aria-label="Main">
      {items.map((item) => {
        const Icon = item.icon;
        const heading = item.group && item.group !== last ? item.group : null;
        if (item.group) last = item.group;
        return (
          <React.Fragment key={item.path}>
            {heading && <div className="px-3 pt-4 pb-1 text-xs text-subtle">{heading}</div>}
            <NavLink to={item.path} onClick={onNavigate} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
              <span className="truncate">{item.label}</span>
            </NavLink>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export function WorkspaceLayout() {
  const { user, organization, logout } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const navItems = useMemo(() => getNavItemsForUser(user && { ...user, organization: organization || user.organization }), [user, organization]);
  const roleLabel = user?.isPlatformAdmin ? ACTOR_LABELS.PLATFORM_ADMIN : (user?.roles || []).map((r) => ACTOR_LABELS[r]).filter(Boolean).join(', ');
  const isReadOnly = !user?.isPlatformAdmin && (user?.roles || []).every((r) => r === 'EXTERNAL_VERIFIER' || r === 'INTERNAL_AUDITOR');
  const title = pageTitleFor(pathname);
  const initials = (user?.fullName || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  useEffect(() => { setDrawer(false); setMenu(false); document.title = title ? `${title} · Tropos` : 'Tropos'; }, [pathname, title]);

  const brand = (
    <div className="flex items-center gap-2.5 px-5 h-16 shrink-0">
      <TroposLogo />
      <div className="min-w-0">
        <div className="text-text font-semibold leading-tight">Tropos</div>
        <div className="text-xs text-muted truncate max-w-[150px]">{organization?.name || 'Platform'}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="hidden lg:flex w-[248px] shrink-0 flex-col sticky top-0 h-screen bg-white border-r border-line">
        {brand}
        <SidebarNav items={navItems} />
        <div className="p-3 border-t border-line">
          <Link to="/profile" className="flex items-center gap-2.5 rounded-md p-2 hover:bg-paper text-text">
            <span className="w-8 h-8 rounded-full bg-brand-600 text-white text-xs font-semibold flex items-center justify-center">{initials}</span>
            <span className="min-w-0 text-sm">
              <span className="block text-text truncate">{user?.fullName}</span>
              <span className="block text-xs text-muted truncate">{roleLabel}</span>
            </span>
          </Link>
        </div>
      </aside>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-[272px] bg-white flex flex-col">
            <div className="flex items-center justify-between pr-3">{brand}<button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="text-text p-2"><X className="w-5 h-5" /></button></div>
            <SidebarNav items={navItems} onNavigate={() => setDrawer(false)} />
          </div>
          <button type="button" aria-label="Close menu" className="flex-1 bg-ink-950/40" onClick={() => setDrawer(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-line px-4 sm:px-6 flex items-center gap-3">
          <button type="button" onClick={() => setDrawer(true)} className="lg:hidden btn-ghost !px-2" aria-label="Open menu"><Menu className="w-5 h-5" /></button>
          <div className="min-w-0 hidden sm:block lg:min-w-[160px]">
            <div className="text-[1.05rem] font-semibold text-text truncate">{title}</div>
          </div>
          <div className="flex-1 max-w-xl mx-auto">{!user?.isPlatformAdmin && <GlobalSearchBar />}</div>
          <div className="flex items-center gap-2">
            {isReadOnly && <span className="badge badge-info hidden md:inline-flex">View only</span>}
            {!user?.isPlatformAdmin && <NotificationDrawer />}
            <div className="relative">
              <button type="button" onClick={() => setMenu(!menu)} className="btn-ghost !px-1.5 gap-1.5" aria-haspopup="menu" aria-expanded={menu}>
                <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold flex items-center justify-center">{initials}</span>
                <ChevronDown className="w-4 h-4 text-muted" />
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 mt-2 w-60 card shadow-lg p-1 z-30">
                  <div className="px-3 py-2 border-b border-line">
                    <div className="text-sm font-semibold truncate">{user?.fullName}</div>
                    <div className="text-xs text-muted truncate">{user?.email}</div>
                  </div>
                  <Link role="menuitem" to="/profile" className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-brand-50"><UserRound className="w-4 h-4" /> My account and security</Link>
                  <button role="menuitem" type="button" onClick={() => logout().then(() => navigate('/login'))} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-brand-50 text-left"><LogOut className="w-4 h-4" /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 sm:px-6 py-6 max-w-[1280px] w-full mx-auto">
          <SetupBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
