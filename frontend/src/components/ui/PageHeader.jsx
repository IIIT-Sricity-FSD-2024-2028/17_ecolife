import './ui.css';

/**
 * The strip at the top of a page: a short description of what the page is for,
 * plus the page's primary actions on the right. The page *name* lives in the
 * topbar, so it is not repeated here. Renders nothing if there's nothing to show.
 */
export function PageHeader({ subtitle, actions }) {
  if (!subtitle && !actions) return null;
  return (
    <div className="page-header">
      <p className="page-header__subtitle">{subtitle}</p>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
