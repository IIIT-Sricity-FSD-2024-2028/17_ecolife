import { useEffect } from 'react';
import { X } from 'lucide-react';
import './ui.css';

/** Right-hand slide-over for record detail, so a list keeps its place. */
export function Drawer({ open, title, subtitle, onClose, children, footer, width = 560 }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !document.querySelector('.dialog-overlay') && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="drawer"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer__header">
          <div>
            <h2 className="drawer__title">{title}</h2>
            {subtitle && <p className="text-muted drawer__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="drawer__body">{children}</div>
        {footer && <footer className="drawer__footer">{footer}</footer>}
      </aside>
    </div>
  );
}
