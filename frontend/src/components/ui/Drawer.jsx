import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './ui.css';

/**
 * Overlay for detail and form content.
 * - default (variant="drawer"): right-hand slide-over, for record detail so the list keeps its place.
 * - variant="modal": centered dialog, for short forms (create / edit / invite). The backdrop does not
 *   close it, so a stray click can't throw away what someone has typed; use the X, Cancel or Escape.
 */
export function Drawer({ open, title, subtitle, onClose, children, footer, width, variant = 'drawer' }) {
  const isModal = variant === 'modal';
  const panelRef = useRef(null);
  const maxWidth = width ?? (isModal ? 520 : 560);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !document.querySelector('.dialog-overlay') && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // A form modal puts the cursor in its first field.
  useEffect(() => {
    if (!open || !isModal) return;
    panelRef.current?.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])')?.focus();
  }, [open, isModal]);

  if (!open) return null;

  const Tag = isModal ? 'section' : 'aside';
  return (
    <div className={isModal ? 'modal-overlay' : 'drawer-overlay'} onClick={isModal ? undefined : onClose}>
      <Tag
        ref={panelRef}
        className={isModal ? 'modal' : 'drawer'}
        style={{ maxWidth }}
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
      </Tag>
    </div>
  );
}
