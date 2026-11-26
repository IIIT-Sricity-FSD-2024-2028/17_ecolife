import React from 'react';

/** Dark forest banner with generated artwork behind it. The first row of tiles floats over its lower edge. */
export function PageHero({ title, description, actions, children }) {
  return (
    <section className="hero px-6 sm:px-8 pt-8 pb-[5.5rem] sm:pb-28 mb-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-[1.7rem] sm:text-[2rem] font-semibold tracking-tight leading-tight text-white">{title}</h1>
          {description && <p className="mt-1.5 text-[0.98rem] text-white/75">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
