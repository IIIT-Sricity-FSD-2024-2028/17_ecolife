import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';

export function NotificationDrawer() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const box = useRef(null);

  const load = () => apiFetch('/notifications').then((r) => setItems(Array.isArray(r) ? r : [])).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const unread = items.filter((i) => !i.isRead).length;
  async function markAll() {
    await apiFetch('/notifications/read-all', { method: 'POST' }).catch(() => {});
    load();
  }

  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => { setOpen(!open); if (!open) load(); }}
        className="btn-ghost !px-2 relative" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open}>
        <Bell className="w-5 h-5" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-danger-600 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">{unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-[22rem] max-w-[90vw] glass-dock p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-xs text-brand-700 hover:underline flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-line">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted">Nothing new. Reminders and review requests will show up here.</div>
            ) : items.slice(0, 15).map((n) => (
              <div key={n.id} className={`px-4 py-3 text-sm ${n.isRead ? 'opacity-60' : ''}`}>
                <div className="font-medium">{n.title}</div>
                <div className="text-muted mt-0.5">{n.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
