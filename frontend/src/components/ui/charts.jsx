import './ui.css';

export function Card({ children, padded = true }) {
  return <div className={`card${padded ? ' card--padded' : ''}`}>{children}</div>;
}

export function CardHeader({ title, subtitle, actions, icon: Icon }) {
  return (
    <div className="card-header">
      <div>
        <h2 className="card-header__title">
          {Icon && <Icon size={18} className="card-header__icon" aria-hidden="true" />}
          {title}
        </h2>
        {subtitle && <p className="card-header__subtitle text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="card-header__actions">{actions}</div>}
    </div>
  );
}

