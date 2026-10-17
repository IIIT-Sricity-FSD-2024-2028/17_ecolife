import React from 'react';

/**
 * Renders a GHG Protocol Corporate Standard Scope badge (Scope 1, Scope 2, Scope 3)
 * mapped to standard resource categories:
 * - Scope 1: Direct emissions (FUEL)
 * - Scope 2: Indirect emissions from purchased energy (ELECTRICITY)
 * - Scope 3: Value chain indirect emissions (WATER, WASTE, TRAVEL, OTHER)
 */
export function ScopeBadge({ category }) {
  if (!category) return <span className="text-muted">—</span>;
  const upper = String(category).toUpperCase();

  let scope = 'Scope 3';
  let color = '#0e7490'; // cyan/teal
  let bg = '#ecfeff';
  let border = '#a5f3fc';

  if (upper === 'FUEL') {
    scope = 'Scope 1';
    color = '#c2410c'; // amber/orange
    bg = '#fff7ed';
    border = '#fed7aa';
  } else if (upper === 'ELECTRICITY') {
    scope = 'Scope 2';
    color = '#6d28d9'; // purple
    bg = '#f5f3ff';
    border = '#ddd6fe';
  }

  return (
    <span
      title={`GHG Protocol ${scope} (${category})`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: '600',
        color,
        backgroundColor: bg,
        border: `1px solid ${border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span>{scope}</span>
      <span style={{ opacity: 0.65, fontWeight: 'normal' }}>· {category}</span>
    </span>
  );
}
