import './ui.css';

const RULES = [
  { key: 'length', label: '8+ characters', test: (v) => v.length >= 8 },
  { key: 'case', label: 'Upper & lowercase', test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { key: 'number', label: 'A number', test: (v) => /\d/.test(v) },
];

/** Compact live checklist shown under a "create password" input. */
export function PasswordRules({ value = '' }) {
  return (
    <ul className="password-rules" aria-label="Must include">
      {RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <li key={rule.key} className={`password-rules__item${ok ? ' is-met' : ''}`}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ok ? <path d="M3 8.5l3.2 3L13 4.5" /> : <circle cx="8" cy="8" r="4.5" />}
            </svg>
            {rule.label}
            <span className="sr-only">{ok ? ' (met)' : ' (not met)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
