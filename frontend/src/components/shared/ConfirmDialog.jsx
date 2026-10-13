import { useEffect } from 'react';
import { AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';
import './shared.css';

/**
 * Confirmation overlay. Nothing it guards happens until the person presses
 * the confirm button; Cancel, Escape, or a click on the backdrop all back out.
 */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, danger, loading = false, icon, confirmDisabled = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !loading && onCancel?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;
  const Icon = icon ?? (danger ? AlertTriangle : HelpCircle);
  return (
    <div className="dialog-overlay" role="presentation" onClick={() => !loading && onCancel?.()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__head">
          <span className={`dialog__icon dialog__icon--${danger ? 'danger' : 'primary'}`} aria-hidden="true">
            <Icon size={20} />
          </span>
          <h3 className="dialog__title" id="confirm-title">{title}</h3>
        </div>
        {message && <div className="text-muted dialog__message">{message}</div>}
        <div className="dialog__actions">
          <button type="button" className="btn btn--secondary btn--md" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn btn--${danger ? 'danger' : 'primary'} btn--md`} onClick={onConfirm} disabled={loading || confirmDisabled} autoFocus={!confirmDisabled}>
            {loading && <Loader2 size={16} className="icon-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
