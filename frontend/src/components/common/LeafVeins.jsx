import React from 'react';

/** Fine leaf-vein lines used as texture on forest-green panels. Decorative only. */
export function LeafVeins({ className = '' }) {
  const veins = [];
  for (let i = 0; i < 9; i += 1) {
    const y = 70 + i * 62;
    veins.push(<path key={`l${i}`} d={`M600 ${y} C 520 ${y - 40}, 430 ${y - 70}, 330 ${y - 70 - i * 6}`} />);
    veins.push(<path key={`r${i}`} d={`M600 ${y} C 680 ${y - 40}, 770 ${y - 70}, 870 ${y - 70 - i * 6}`} />);
  }
  return (
    <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" className={`absolute inset-0 w-full h-full pointer-events-none ${className}`} aria-hidden="true">
      <g fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth="1.4" strokeLinecap="round">
        <path d="M600 -20 L600 720" strokeOpacity="0.1" strokeWidth="2" />
        {veins}
      </g>
    </svg>
  );
}
