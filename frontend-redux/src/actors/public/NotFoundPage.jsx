import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="glass-card p-8 max-w-md w-full text-center space-y-3">
        <div className="text-3xl font-bold text-text tabular-nums">404</div>
        <div className="text-base font-semibold text-text">Page not found</div>
        <p className="text-sm text-muted">This page does not exist. The link may be old or mistyped.</p>
        <Link to="/" className="inline-flex items-center justify-center h-9 px-4 rounded-xl btn-primary text-xs font-semibold">Go to my dashboard</Link>
      </div>
    </div>
  );
}
