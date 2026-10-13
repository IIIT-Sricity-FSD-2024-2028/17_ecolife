import { Inbox } from 'lucide-react';
import './shared.css';

export function EmptyState({ title, description, action, icon: Icon = Inbox }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        <Icon size={24} />
      </span>
      <p className="empty-state__title">{title}</p>
      {description && <p className="text-muted empty-state__description">{description}</p>}
      {action}
    </div>
  );
}
