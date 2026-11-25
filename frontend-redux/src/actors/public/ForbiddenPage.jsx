import React from 'react';
import { Link } from 'react-router-dom';

export default function ForbiddenPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="glass-card p-8 max-w-md w-full text-center space-y-3">
        <div className="text-3xl font-bold text-danger-600 tabular-nums">403</div>
        <div className="text-base font-semibold text-text">You do not have access to this page</div>
        <p className="text-sm text-muted">Your role does not include this page. If you need it, ask your company administrator to change your role.</p>
        <Link to="/" className="inline-flex items-center justify-center h-9 px-4 rounded-xl btn-primary text-xs font-semibold">Go to my dashboard</Link>
      </div>
    </div>
  );
}
