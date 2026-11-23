import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button, CheckField, FormGrid, NumberField, SelectField, TextAreaField, TextField, DateField } from './index.jsx';

const DialogContext = createContext(null);

/** Modal frame: Escape closes, focus moves inside, background is inert for pointer users. */
export function Dialog({ open, title, description, onClose, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector('input,select,textarea,button:not([data-close])');
    first?.focus();
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/45" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`glass-dock w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-line">
          <div>
            <h2 className="text-lg font-semibold text-text">{title}</h2>
            {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
          </div>
          <button type="button" data-close onClick={onClose} aria-label="Close" className="btn-ghost btn-sm !px-1.5"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line flex justify-end gap-2 bg-[#F8F9F6] rounded-b-[10px]">{footer}</div>}
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  );
}

const FIELD = { text: TextField, number: NumberField, date: DateField, select: SelectField, textarea: TextAreaField };

function FormBody({ spec, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => Object.fromEntries((spec.fields || []).map((f) => [f.name, f.defaultValue ?? (f.type === 'checkbox' ? false : (f.type === 'select' && !f.placeholder && f.options?.length ? f.options[0].value : ''))])));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (name, v) => { setValues((p) => ({ ...p, [name]: v })); setErrors((p) => ({ ...p, [name]: undefined })); };

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    for (const f of spec.fields || []) {
      const v = values[f.name];
      if (f.required && (v === '' || v == null)) errs[f.name] = `${f.label} is required.`;
      else if (f.minLength && String(v).trim().length < f.minLength) errs[f.name] = `Write at least ${f.minLength} characters.`;
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setBusy(true);
    try { await onSubmit(values); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate>
      <FormGrid cols={1}>
        {(spec.fields || []).map((f) => {
          if (f.type === 'checkbox') return <CheckField key={f.name} label={f.label} hint={f.hint} checked={values[f.name]} onChange={(v) => set(f.name, v)} />;
          const C = FIELD[f.type || 'text'];
          return <C key={f.name} label={f.label} hint={f.hint} placeholder={f.placeholder} required={f.required} optional={!f.required} options={f.options} value={values[f.name]} error={errors[f.name]} onChange={(v) => set(f.name, v)} unit={f.unit} />;
        })}
      </FormGrid>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant={spec.danger ? 'danger' : 'primary'} loading={busy}>{spec.submitLabel || 'Save'}</Button>
      </div>
    </form>
  );
}

export function DialogProvider({ children }) {
  const [state, setState] = useState(null); // { kind, spec, resolve }

  const confirm = useCallback((spec) => new Promise((resolve) => setState({ kind: 'confirm', spec, resolve })), []);
  const form = useCallback((spec) => new Promise((resolve) => setState({ kind: 'form', spec, resolve })), []);
  const close = (value) => { state?.resolve(value); setState(null); };

  return (
    <DialogContext.Provider value={{ confirm, form }}>
      {children}
      {state?.kind === 'confirm' && (
        <Dialog open title={state.spec.title} onClose={() => close(false)}
          footer={<><Button variant="secondary" onClick={() => close(false)}>{state.spec.cancelLabel || 'Cancel'}</Button><Button variant={state.spec.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state.spec.confirmLabel || 'Confirm'}</Button></>}>
          <p className="text-sm text-text">{state.spec.message}</p>
        </Dialog>
      )}
      {state?.kind === 'form' && (
        <Dialog open title={state.spec.title} description={state.spec.description} onClose={() => close(null)} wide={state.spec.wide}>
          <FormBody spec={state.spec} onSubmit={(v) => close(v)} onCancel={() => close(null)} />
        </Dialog>
      )}
    </DialogContext.Provider>
  );
}

/** const { confirm, form } = useDialog();  await confirm({...}) -> true/false;  await form({...}) -> values or null */
export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
  return ctx;
}
