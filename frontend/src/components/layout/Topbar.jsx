import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, BellOff, ChevronDown, ChevronRight, LogOut, User } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useConfirm } from '../shared/ConfirmProvider';
import './layout.css';

/** Closes a popover on outside click, Escape, or route change. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}

function NotificationMenu({ portal, role }) {
  const { open, setOpen, ref } = usePopover();
  const { items, count, isLoading } = useNotifications({ portal, role });

  return (
    <div className="topbar__menu" ref={ref}>
      <button
        type="button"
        className="topbar__icon-btn"
        aria-label={count ? `Notifications, ${count} need attention` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={20} aria-hidden="true" />
        {count > 0 && <span className="topbar__badge">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <div className="popover popover--wide" role="menu">
          <div className="popover__header">
            <span>Notifications</span>
            {count > 0 && <span className="popover__count">{count}</span>}
          </div>
          {isLoading && <p className="popover__empty text-muted">Loading…</p>}
          {!isLoading && items.length === 0 && (
            <div className="popover__empty">
              <BellOff size={22} aria-hidden="true" />
              <p>You're all caught up.</p>
            </div>
          )}
          {items.map((n) => {
            const Icon = n.icon;
            return (
              <Link key={n.id} to={n.to} className="popover__item popover__item--notification" role="menuitem">
                <span className="popover__item-icon" aria-hidden="true"><Icon size={16} /></span>
                <span className="popover__item-text">
                  <span className="popover__item-title">{n.text}</span>
                  {n.detail && <span className="popover__item-detail text-muted">{n.detail}</span>}
                </span>
                <ChevronRight size={16} className="popover__chevron" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProfileMenu({ displayName, email, roleLabel, profilePath, onLogout }) {
  const { open, setOpen, ref } = usePopover();
  const confirm = useConfirm();
  const initials = (displayName || email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  const askLogout = async () => {
    setOpen(false);
    const ok = await confirm({
      title: 'Log out of Tropos?',
      message: 'You will need to sign in again to continue. Any unsaved changes on this page will be lost.',
      confirmLabel: 'Log out',
      icon: LogOut,
    });
    if (ok) onLogout();
  };

  return (
    <div className="topbar__menu" ref={ref}>
      <button type="button" className="topbar__profile-btn" aria-haspopup="true" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">{initials}</span>
        <span className="topbar__profile-name">{displayName || email}</span>
        <ChevronDown size={16} className={`topbar__caret${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="popover" role="menu">
          <div className="popover__identity">
            <strong>{displayName || email}</strong>
            {displayName && <span className="text-muted">{email}</span>}
            {roleLabel && <span className="popover__role">{roleLabel}</span>}
          </div>
          <Link to={profilePath} className="popover__item" role="menuitem">
            <User size={16} aria-hidden="true" />
            Profile
          </Link>
          <button type="button" className="popover__item popover__item--danger" role="menuitem" onClick={askLogout}>
            <LogOut size={16} aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

/** The name of the page being viewed, taken from the nav item that matches the URL. */
function usePageTitle(items = []) {
  const { pathname } = useLocation();
  const match = [...items]
    .sort((a, b) => b.path.length - a.path.length)
    .find((i) => pathname === i.path || pathname.startsWith(`${i.path}/`));
  return match?.label ?? '';
}

/**
 * Page name (plain text, no icon) on the left; notifications bell and the profile
 * dropdown on the right. The logo lives in the sidebar, so it isn't repeated here.
 * `onLogout` stays a callback prop — Topbar doesn't know how logout works,
 * it only asks for confirmation and then calls it.
 */
export function Topbar({ portal = 'org', role, navItems, displayName, email, roleLabel, profilePath, onLogout }) {
  const title = usePageTitle(navItems);
  useEffect(() => {
    document.title = title ? `${title} · Tropos` : 'Tropos';
  }, [title]);

  return (
    <header className="topbar">
      <h1 className="topbar__title">{title}</h1>
      <div className="topbar__actions">
        <NotificationMenu portal={portal} role={role} />
        <ProfileMenu displayName={displayName} email={email} roleLabel={roleLabel} profilePath={profilePath} onLogout={onLogout} />
      </div>
    </header>
  );
}
