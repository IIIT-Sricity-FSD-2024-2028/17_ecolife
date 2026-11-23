import React, { useState } from 'react';
import { PageHeader, TextField } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';

const words = (s) => String(s || '').toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export default function PlatformActivityPage() {
  const [action, setAction] = useState('');
  return (
    <div>
      <PageHeader title="Platform activity" description="Everything platform administrators have done. It cannot be edited or deleted." />
      <DataGrid endpoint="/platform/activity" params={{ action: action.trim().toUpperCase().replace(/ /g, '_') }} exportName="platform-activity" initialPageSize={50}
        toolbar={<TextField className="w-72" label="" aria-label="Exact action" placeholder="Exact action, e.g. TRIAL_EXTENDED" value={action} onChange={setAction} />}
        columns={[{ key: 'd', label: 'When', render: (r) => new Date(r.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), value: (r) => r.createdAt },
          { key: 'a', label: 'What', render: (r) => <span className="font-medium">{words(r.action)}</span>, value: (r) => r.action },
          { key: 'r', label: 'Reason', hideOnMobile: true, render: (r) => r.metadata?.reason || '', value: (r) => r.metadata?.reason }]}
        emptyTitle="Nothing matches" emptyText="Check the action name." />
    </div>
  );
}
