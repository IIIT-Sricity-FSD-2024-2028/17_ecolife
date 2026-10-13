import './ui.css';

// Maps a status string to a semantic visual tone — every status badge in
// the app (submissions, reports, alerts) goes through this one place.
const TONE_BY_STATUS = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
  CHANGES_REQUESTED: 'warning',
  LOCKED: 'success',
  PENDING_APPROVAL: 'info',
  REVISION_REQUESTED: 'warning',
  SUPERSEDED: 'neutral',
  OPEN: 'warning',
  RESOLVED: 'success',
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  TRIAL: 'info',
  PENDING: 'PENDING',
};

export function StatusBadge({ status, label }) {
  const tone = TONE_BY_STATUS[status] || 'neutral';
  return <span className={`status-badge status-badge--${tone}`}>{label || status}</span>;
}
