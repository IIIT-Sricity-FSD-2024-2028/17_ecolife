import { Mark } from './Brand';
import './AuthLayout.css';

const BRAND_COPY = {
  org: {
    statement: 'Track resource use. Understand its climate cost.',
    detail: 'Log usage, get it reviewed, and report emissions that your auditors can trace.',
  },
  admin: {
    statement: 'Platform administration',
    detail: 'Manage organizations, plans, and platform-wide settings.',
  },
};

// Layered wavy lines, like atmospheric strata. Computed once at module load
// so the artwork is deterministic and cheap to render.
const STRATA_W = 600;
const STRATA_H = 480;
const STRATA = Array.from({ length: 16 }, (_, i) => {
  const baseY = 30 + i * 28;
  const amplitude = 6 + i * 1.6;
  const frequency = 0.016 + (i % 4) * 0.003;
  const phase = i * 0.9;
  let d = '';
  for (let x = 0; x <= STRATA_W; x += 12) {
    const y = baseY + amplitude * Math.sin(x * frequency + phase);
    d += `${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`;
  }
  return { d, opacity: 0.16 + i * 0.03, accent: i === 5 || i === 11 };
});

function Strata() {
  return (
    <svg
      className="auth-brand__art"
      viewBox={`0 0 ${STRATA_W} ${STRATA_H}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      {STRATA.map((line, i) => (
        <path key={i} d={line.d} strokeOpacity={line.opacity} className={line.accent ? 'is-accent' : undefined} />
      ))}
    </svg>
  );
}

/**
 * Shared frame for every sign-in style page (org + admin). Pages supply the
 * heading, optional subtitle, the form, and an optional footer of links.
 */
export function AuthLayout({ variant = 'org', title, subtitle, footer, children }) {
  const copy = BRAND_COPY[variant] ?? BRAND_COPY.org;

  return (
    <div className={`auth-shell auth-shell--${variant}`}>
      <div className="auth-brand">
        <div className="auth-wordmark">
          <Mark />
          <span>Tropos</span>
        </div>
        <div className="auth-brand__body">
          <p className="auth-brand__statement">{copy.statement}</p>
          <p className="auth-brand__detail">{copy.detail}</p>
        </div>
        <Strata />
      </div>

      <main className="auth-main">
        <div className="auth-panel">
          <h1 className="auth-panel__title">{title}</h1>
          {subtitle && <p className="auth-panel__subtitle">{subtitle}</p>}
          {children}
          {footer && <div className="auth-links">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
