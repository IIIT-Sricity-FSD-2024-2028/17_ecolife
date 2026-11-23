import { useEffect, useState } from 'react';
import { apiFetch } from '../services/apiClient';

/** Choice lists come from the backend (GET /meta/options); fetched once per session and shared. */
let cache = null;
let inflight = null;
export function useOptions() {
  const [opts, setOpts] = useState(cache);
  useEffect(() => {
    if (cache) return;
    inflight = inflight || apiFetch('/meta/options').then((r) => { cache = r; return r; }).catch(() => { inflight = null; return null; });
    inflight.then((r) => r && setOpts(r));
  }, []);
  return { enums: opts?.enums || {}, rules: opts?.rules || {}, ready: Boolean(opts) };
}

/** [{value,label}] for a SelectField, with labels in everyday words. */
export const toOptions = (values = [], labels = {}) => values.map((v) => ({ value: v, label: labels[v] || String(v).toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) }));
