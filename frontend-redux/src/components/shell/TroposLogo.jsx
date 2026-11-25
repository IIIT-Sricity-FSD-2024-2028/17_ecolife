import React from 'react';

/** The Tropos mark from the first design: two sweeping strokes and a dot on a rounded tile, here in the green family. */
export const TroposLogo = React.memo(function TroposLogo({ variant = 'sidebar', size = 36 }) {
  const hero = variant === 'hero';
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-[11px] flex items-center justify-center shrink-0 ring-1 ring-white/20 ${
        hero ? 'bg-gradient-to-br from-[#064E3B] to-[#22C58B] shadow-md' : 'bg-gradient-to-br from-[#22C58B] to-[#064E3B] shadow-sm'
      }`}
    >
      <svg viewBox="0 0 28 28" style={{ width: size * 0.62, height: size * 0.62 }} fill="none" aria-hidden="true">
        <path d="M5 17.5C6.8 11.2 12.6 7 19.5 7.5C21.2 7.6 22.6 8 23.5 8.6" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M7.5 21C9.8 16.5 14.3 13.8 19.8 14.1" stroke="#BBF7D0" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="20.5" cy="19.5" r="2.2" fill="#86EFAC" />
      </svg>
    </div>
  );
});
