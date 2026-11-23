import React, { useId } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, Inbox } from 'lucide-react';

/* ---------- buttons ---------- */
export function Button({ variant = 'primary', size, className = '', loading, children, ...rest }) {
  const v = { primary: 'btn-primary', secondary: 'btn-secondary', danger: 'btn-danger', ghost: 'btn-ghost' }[variant];
  return (
    <button type="button" {...rest} disabled={rest.disabled || loading} className={`${v} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}>
      {loading ? 'Please wait…' : children}
    </button>
  );
}

/* ---------- form fields ----------
   Every control shows: a label in plain words, an optional/required marker, a hint saying what to enter and where to find it,
   and an error line. onChange receives the value, not the event. */
export function Field({ label, hint, error, required, optional, children, className = '', htmlFor }) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-[0.85rem] font-medium text-text">
          <span>{label}{required && <span className="text-danger-600" aria-hidden="true"> *</span>}</span>
          {optional && <span className="text-xs font-normal text-subtle">Optional</span>}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-danger-600 flex items-start gap-1" role="alert"><AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />{error}</p>
        : hint ? <p className="text-xs text-muted leading-snug">{hint}</p> : null}
    </div>
  );
}

function useFieldId(id) { const auto = useId(); return id || auto; }

export function TextField({ label, hint, error, required, optional, unit, value, onChange, className = '', type = 'text', id, ...rest }) {
  const fid = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} required={required} optional={optional} className={className} htmlFor={fid}>
      <div className="relative">
        <input id={fid} type={type} required={required} aria-invalid={error ? 'true' : undefined} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} className={`input ${unit ? 'pr-16' : ''}`} {...rest} />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">{unit}</span>}
      </div>
    </Field>
  );
}

export function NumberField(props) { return <TextField type="number" inputMode="decimal" step="any" {...props} />; }
export function DateField(props) { return <TextField type="date" {...props} />; }

export function SelectField({ label, hint, error, required, optional, value, onChange, options = [], placeholder, className = '', id, ...rest }) {
  const fid = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} required={required} optional={optional} className={className} htmlFor={fid}>
      <select id={fid} required={required} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} className="input" {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function TextAreaField({ label, hint, error, required, optional, value, onChange, rows = 3, className = '', id, ...rest }) {
  const fid = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} required={required} optional={optional} className={className} htmlFor={fid}>
      <textarea id={fid} rows={rows} required={required} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} className="input" style={{ minHeight: '5rem', paddingTop: '.55rem' }} {...rest} />
    </Field>
  );
}

export function CheckField({ label, hint, checked, onChange, className = '', id }) {
  const fid = useFieldId(id);
  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <input id={fid} type="checkbox" checked={!!checked} onChange={(e) => onChange?.(e.target.checked)} className="mt-1" />
      <label htmlFor={fid} className="text-[0.9rem] leading-snug">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted mt-0.5">{hint}</span>}
      </label>
    </div>
  );
}

/** Lays fields out in a responsive grid; use span="2" on a field wrapper for wide ones. */
export function FormGrid({ cols = 2, children, className = '' }) {
  const c = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }[cols];
  return <div className={`grid grid-cols-1 ${c} gap-x-4 gap-y-3.5 ${className}`}>{children}</div>;
}

/* ---------- surfaces ---------- */
export function Card({ title, description, actions, children, className = '', padded = true }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
          <div className="min-w-0">
            {title && <h2 className="text-[1.02rem] font-semibold text-text">{title}</h2>}
            {description && <p className="text-sm text-muted mt-0.5 max-w-2xl">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-[1.5rem] font-semibold text-text leading-tight">{title}</h1>
        {description && <p className="text-[0.95rem] text-muted mt-1 max-w-3xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** The "what should I do next" strip. tone: info | warn | ok | danger */
export function NextStep({ tone = 'info', title, children, action }) {
  const t = {
    info: ['bg-brand-50 border-brand-100', Info, 'text-brand-600'],
    warn: ['bg-saffron-50 border-saffron-100', TriangleAlert, 'text-saffron-600'],
    ok: ['bg-ok-50 border-ok-50', CheckCircle2, 'text-ok-600'],
    danger: ['bg-danger-50 border-danger-50', AlertCircle, 'text-danger-600']
  }[tone];
  const Icon = t[1];
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-[10px] border px-4 py-3 mb-4 ${t[0]}`}>
      <Icon className={`w-5 h-5 shrink-0 ${t[2]}`} />
      <div className="min-w-0 flex-1 text-sm">
        {title && <div className="font-semibold text-text">{title}</div>}
        {children && <div className="text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ tone = 'info', children, className = '' }) {
  const m = { info: 'badge-info', warn: 'badge-warn', danger: 'badge-danger', ok: 'badge-ok' }[tone];
  return <div className={`${m} !rounded-md !items-start !px-3 !py-2 text-sm font-normal ${className}`}>{children}</div>;
}

export function Stat({ label, value, unit, note, tone }) {
  const color = tone === 'danger' ? 'text-danger-600' : tone === 'warn' ? 'text-saffron-600' : 'text-text';
  return (
    <div className="card px-4 py-3.5">
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-1 text-[1.65rem] leading-none font-semibold tabular-nums ${color}`}>{value}{unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}</div>
      {note && <div className="mt-1.5 text-xs text-muted">{note}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action, icon: Icon = Inbox }) {
  return (
    <div className="text-center py-10 px-4">
      <Icon className="w-9 h-9 mx-auto text-subtle" />
      <h3 className="mt-3 text-base font-semibold text-text">{title}</h3>
      {children && <p className="mt-1 text-sm text-muted max-w-md mx-auto">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- status ---------- */
const STATUS = {
  DRAFT: ['neutral', 'Draft'], SUBMITTED: ['info', 'Waiting for review'], APPROVED: ['ok', 'Approved'], REJECTED: ['danger', 'Sent back'], WITHDRAWN: ['neutral', 'Withdrawn'],
  PENDING: ['warn', 'Waiting for approval'], PENDING_APPROVAL: ['warn', 'Waiting for approval'], PUBLISHED: ['ok', 'In use'], SUPERSEDED: ['neutral', 'Replaced'],
  OPEN: ['info', 'Open'], REOPENED: ['warn', 'Reopened'], CLOSED: ['neutral', 'Closed'], SIGNED_OFF: ['ok', 'Signed off'],
  UNPAID: ['warn', 'Unpaid'], PAID: ['ok', 'Paid'], CANCELLED: ['neutral', 'Cancelled'],
  TRIAL: ['info', 'Trial'], ACTIVE: ['ok', 'Active'], PAST_DUE: ['warn', 'Payment overdue'], SUSPENDED: ['danger', 'Suspended'],
  PLANNED: ['neutral', 'Planned'], IN_PROGRESS: ['info', 'In progress'], DELAYED: ['warn', 'Delayed'], COMPLETED: ['ok', 'Completed'], PARTIALLY_ACHIEVED: ['warn', 'Partly achieved'],
  ON_TRACK: ['ok', 'On track'], AT_RISK: ['warn', 'At risk'], OFF_TRACK: ['danger', 'Off track'], ACHIEVED: ['ok', 'Achieved'], MISSED: ['danger', 'Missed'],
  ISSUED: ['info', 'Issued'], PROCURED: ['info', 'Bought'], PENDING_RETIREMENT: ['warn', 'Retirement requested'], RETIRED: ['ok', 'Retired'], EXTINGUISHED: ['neutral', 'Extinguished'], TRANSFERRED_SUBSIDIARY: ['neutral', 'Transferred'],
  ACCEPTED: ['ok', 'Accepted']
};
export function StatusBadge({ status, label }) {
  const [tone, text] = STATUS[status] || ['neutral', String(status || '').toLowerCase().replace(/_/g, ' ')];
  return <span className={`badge badge-${tone}`}>{label || text}</span>;
}
export const humanize = (s) => String(s ?? '').toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
