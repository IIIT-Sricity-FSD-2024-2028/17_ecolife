import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSetupProgress } from '../../hooks/useSetupProgress';

export function SetupBanner() {
  const { canSetUp, loading, steps, complete } = useSetupProgress();
  const { pathname } = useLocation();
  if (!canSetUp || loading || complete || pathname === '/setup') return null;
  const left = steps.filter((s) => !s.done).length;
  return (
    <div className="mb-5 rounded-xl border border-line bg-mist px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
      <span className="flex-1 min-w-[12rem]"><strong>Finish setting up.</strong> {left} {left === 1 ? 'step is' : 'steps are'} left before your first month is ready.</span>
      <Link to="/setup" className="font-medium text-emerald-700 hover:underline min-h-[44px] inline-flex items-center">See what is left</Link>
    </div>
  );
}
