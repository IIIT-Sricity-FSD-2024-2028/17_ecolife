import React from 'react';
import { Link } from 'react-router-dom';

export default function ForbiddenPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="glass-card p-8 max-w-md w-full text-center space-y-3">
        <div className="text-3xl font-bold text-danger-600 tabular-nums">403</div>
        <div className="text-sm font-semibold text-text">Role Access Restricted</div>
        <p className="text-xs text-text">Your current actor role does not have permission to access this screen (COSO Separation of Duties).</p>
        <Link to="/" className="inline-flex items-center justify-center h-9 px-4 rounded-xl btn-primary text-xs font-semibold">Back to My Workspace</Link>
      </div>
    </div>
  );
}
