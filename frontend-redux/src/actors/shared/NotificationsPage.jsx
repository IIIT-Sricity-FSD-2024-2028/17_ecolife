import React from 'react';
import { CheckCheck } from 'lucide-react';
import { useAction } from '../../hooks/useAction';
import { useForm } from '../../hooks/useForm';
import { Button, PageHeader } from '../../components/ui';
import { DataGrid } from '../../components/ui/DataGrid';
import { fmtDate } from '../../utils/formatters';

export default function NotificationsPage() {
  const act = useAction();
  const f = useForm('notifications-page', { unread: false });
  const { unread } = f.values;
  const columns = [
    { key: 't', label: 'Message', render: (r) => <div className="flex gap-2.5"><span className={`mt-2 w-2 h-2 rounded-full shrink-0 ${r.isRead ? 'bg-transparent' : 'bg-brand-500'}`} aria-label={r.isRead ? 'Read' : 'Unread'} /><div><div className={r.isRead ? 'text-text' : 'font-semibold text-text'}>{r.title}</div><div className="text-sm text-muted">{r.body}</div></div></div>, value: (r) => `${r.title}: ${r.body}` },
    { key: 'd', label: 'When', render: (r) => fmtDate(r.createdAt), value: (r) => r.createdAt },
    { key: 'a', label: '', render: (r) => !r.isRead && <Button size="sm" variant="ghost" onClick={() => act({ path: `/notifications/${r.id}/read`, method: 'PATCH' })}>Mark as read</Button> }
  ];
  return (
    <div>
      <PageHeader title="Notifications" description="Reviews, reminders and changes that affect you." actions={<Button variant="secondary" onClick={() => act({ path: '/notifications/read-all', method: 'POST' })}><CheckCheck className="w-4 h-4" /> Mark all as read</Button>} />
      <DataGrid endpoint="/notifications" params={{ unread: unread ? 'true' : '' }} columns={columns} exportName="notifications"
        toolbar={<label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={unread} onChange={(e) => f.set('unread', e.target.checked)} className="w-4 h-4 accent-brand-600" /> Only unread</label>}
        emptyTitle={unread ? 'No unread messages' : 'No notifications yet'} emptyText="You will see messages here when something needs your attention." />
    </div>
  );
}
