import { Card } from './Card';
import './ui.css';

/** Pure presentational — receives everything as props, used across all
 * four role dashboards instead of each hand-writing its own stat markup. */
export function SummaryCard({ label, value, icon: Icon, children }) {
  return (
    <Card>
      <div className="summary-card__top">
        <p className="summary-card__label">{label}</p>
        {Icon && (
          <span className="summary-card__icon" aria-hidden="true">
            <Icon size={18} />
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <p className="summary-card__value" style={{ margin: 0 }}>{value}</p>
        {children}
      </div>
    </Card>
  );
}
