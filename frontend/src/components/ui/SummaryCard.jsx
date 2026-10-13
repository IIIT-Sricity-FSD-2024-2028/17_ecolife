import { Card } from './Card';
import './ui.css';

/** Pure presentational — receives everything as props, used across all
 * four role dashboards instead of each hand-writing its own stat markup. */
export function SummaryCard({ label, value, icon: Icon }) {
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
      <p className="summary-card__value">{value}</p>
    </Card>
  );
}
