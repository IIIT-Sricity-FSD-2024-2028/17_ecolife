import React, { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { Button, PageHeader } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { fmtDate } from '../../utils/formatters';

export default function NotificationsPage() {
  const [unread, setUnread] = useState(false);
  const [tick, setTick] = useState(0);
  const columns = [
    { key: 't', label: 'Message', render: (r) => <div className="flex gap-2.5"><span className={`mt-2 w-2 h-2 rounded-full shrink-0 ${r.isRead ? 'bg-transparent' : 'bg-brand-500'}`} aria-label={r.isRead ? 'Read' : 'Unread'} /><div><div className={r.isRead ? 'text-text' : 'font-semibold text-text'}>{r.title}</div><div className="text-sm text-muted">{r.body}</div></div></div>, value: (r) => `${r.title}: ${r.body}` },
    { key: 'd', label: 'When', render: (r) => fmtDate(r.createdAt), value: (r) => r.createdAt },
    { key: 'a', label: '', render: (r) => !r.isRead && <Button size="sm" variant="ghost" onClick={() => apiFetch(`/notifications/${r.id}/read`, { method: 'PATCH' }).then(() => setTick((t) => t + 1))}>Mark as read</Button> }
  ];
  return (
    <div>
      <PageHeader title="Notifications" description="Reviews, reminders and changes that affect you." actions={<Button variant="secondary" onClick={() => apiFetch('/notifications/read-all', { method: 'POST' }).then(() => setTick((t) => t + 1))}><CheckCheck className="w-4 h-4" /> Mark all as read</Button>} />
      <DataGrid endpoint="/notifications" params={{ unread: unread ? 'true' : '' }} refreshKey={tick} columns={columns} exportName="notifications"
        toolbar={<label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} className="w-4 h-4 accent-brand-600" /> Only unread</label>}
        emptyTitle={unread ? 'No unread messages' : 'No notifications yet'} emptyText="You will see messages here when something needs your attention." />
    </div>
  );
}
