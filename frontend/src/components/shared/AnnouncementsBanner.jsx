import { useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useAnnouncements } from '../../hooks/useCollaboration';
import { fmtDate } from '../../utils/format';
import './shared.css';

const KEY = 'tropos.dismissedAnnouncements';
const MAX_SHOWN = 3;

function readDismissed() {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

/** Active announcements for the signed-in person. Dismissing hides one for this browser session only. */
export function AnnouncementsBanner() {
  const { data: items = [] } = useAnnouncements();
  const [dismissed, setDismissed] = useState(readDismissed);

  const visible = items.filter((a) => !dismissed.includes(a.id)).slice(0, MAX_SHOWN);
  if (visible.length === 0) return null;

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable: the banner just comes back on reload */ }
  };

  return (
    <div className="announcement-banner" role="region" aria-label="Announcements">
      {visible.map((a) => (
        <div key={a.id} className="announcement">
          <Megaphone size={18} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
          <div className="announcement__main">
            <div className="announcement__title">{a.title}</div>
            <p className="announcement__body">{a.body}</p>
            <div className="text-muted announcement__meta">
              {a.createdByName} · {fmtDate(a.createdAt)}{a.departmentName ? ` · ${a.departmentName} only` : ''}
            </div>
          </div>
          <button type="button" className="announcement__dismiss" onClick={() => dismiss(a.id)} aria-label={`Dismiss "${a.title}"`}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
