import { useId, useState, cloneElement, isValidElement, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './ui.css';

/**
 * Shared form field: label + input + error message, rendered the same way
 * everywhere. The label is programmatically tied to the input via a
 * generated id (so screen readers announce it and clicking the label
 * focuses the input), and validation errors are linked with
 * aria-describedby / aria-invalid.
 */
export function FormField({ label, error, required, children, hint, status }) {
  const id = useId();
  const errorId = `${id}-error`;
  // Accepts a react-hook-form error object ({ message }) or a plain string (used by the hand-built forms).
  const errorMessage = typeof error === 'string' ? error : error?.message;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : undefined,
      })
    : children;

  return (
    <div className="form-field">
      {label && (
        <label className="form-field__label" htmlFor={id}>
          {label}
          {required && <span className="form-field__required"> *</span>}
        </label>
      )}
      {control}
      {hint && !error && !status && <p className="form-field__hint text-muted">{hint}</p>}
      {status && !error && (
        <p className={`form-field__status form-field__status--${status.tone}`} role="status">
          {status.text}
        </p>
      )}
      {error && (
        <p className="form-field__error" id={errorId} role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

// forwardRef is essential here, not stylistic: react-hook-form's register()
// passes a `ref` so it can read the DOM input's value directly (uncontrolled
// inputs). A plain function component silently drops that ref — React warns
// "Function components cannot be given refs" — and RHF then has no way to
// see what the user typed, so every field validates as empty regardless of
// input. This bit us during integration testing: forms looked fine visually
// but always reported "Required" on submit.
export const TextInput = forwardRef(function TextInput({ error, ...props }, ref) {
  return <input ref={ref} className={`text-input${error ? ' text-input--error' : ''}`} {...props} />;
});

export const TextArea = forwardRef(function TextArea({ error, ...props }, ref) {
  return <textarea ref={ref} className={`text-input${error ? ' text-input--error' : ''}`} {...props} />;
});

export const Select = forwardRef(function Select({ error, children, ...props }, ref) {
  return (
    <select ref={ref} className={`text-input${error ? ' text-input--error' : ''}`} {...props}>
      {children}
    </select>
  );
});

/** Password input with a show/hide (eye) toggle. */
export const PasswordInput = forwardRef(function PasswordInput({ error, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-input">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={`text-input${error ? ' text-input--error' : ''}`}
        {...props}
      />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
});
