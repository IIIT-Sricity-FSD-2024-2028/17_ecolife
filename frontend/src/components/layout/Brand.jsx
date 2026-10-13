import { Link } from 'react-router-dom';
import './layout.css';

/** The Tropos strata mark — the same glyph used on the sign-in screens. */
export function Mark({ size = 28 }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M2 8 q4 -4 8 0 t8 0 t8 0" />
      <path d="M2 14 q4 -4 8 0 t8 0 t8 0" />
      <path d="M2 20 q4 -4 8 0 t8 0 t8 0" />
    </svg>
  );
}

/** Wordmark: mark + "Tropos" in the display font, optionally linking home. */
export function Brand({ to, tag, size = 'md' }) {
  const body = (
    <>
      <Mark size={size === 'lg' ? 28 : 24} />
      <span className="brand__name">Tropos</span>
      {tag && <span className="brand__tag">{tag}</span>}
    </>
  );
  return to ? (
    <Link to={to} className={`brand brand--${size}`} aria-label="Tropos home">
      {body}
    </Link>
  ) : (
    <div className={`brand brand--${size}`}>{body}</div>
  );
}
