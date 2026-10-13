import { NavLink } from 'react-router-dom';
import { Brand } from './Brand';
import './layout.css';

/**
 * Pure presentational component: it doesn't know about roles at all, it
 * just renders whatever `items` it's given (each with a lucide `icon`). The
 * role→items mapping lives in utils/permissions.js and is passed down as a
 * prop — this is the "props flow down" half of the Sidebar/DashboardShell pair.
 */
export function Sidebar({ items, roleLabel, homePath, tag }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <Brand to={homePath} tag={tag} size="lg" />
      </div>
      <nav className="sidebar__nav">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/' || ['/contributor', '/reviewer', '/org-admin', '/executive', '/admin'].includes(item.path)}
              className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
            >
              {Icon && <Icon size={18} aria-hidden="true" />}
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar__role">{roleLabel}</div>
    </aside>
  );
}
