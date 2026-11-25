import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { selectToasts, toastDismissed, toastPushed } from '../store/slices/app/toastSlice';

/** Draws the messages held in the store (toasts slice). */
export function ToastProvider({ children }) {
  const dispatch = useDispatch();
  const toasts = useSelector(selectToasts);
  const portalRoot = typeof document !== 'undefined' ? document.getElementById('modal-root') || document.body : null;
  return (
    <>
      {children}
      {portalRoot &&
        createPortal(
          <div className="fixed bottom-5 right-5 z-50 space-y-2 max-w-sm w-full pointer-events-none">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`pointer-events-auto glass-dock px-4 py-3 flex items-start gap-2.5 text-sm border-l-4 ${
                  t.variant === 'error' ? '!border-l-danger-600 text-text' : '!border-l-ok-600 text-text'
                }`}
              >
                {t.variant === 'error' ? <AlertCircle className="w-4 h-4 shrink-0 text-danger-600 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-ok-600 mt-0.5" />}
                <span className="flex-1 leading-relaxed">{t.message}</span>
                <button type="button" onClick={() => dispatch(toastDismissed(t.id))} className="text-muted hover:text-text">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>,
          portalRoot
        )}
    </>
  );
}

export function useToast() {
  const dispatch = useDispatch();
  return useMemo(() => ({ pushToast: (message, variant = 'success') => dispatch(toastPushed(message, variant)) }), [dispatch]);
}
