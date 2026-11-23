import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import { getNavItemsForUser } from '../../config/actorNavigation';

/** Pick a page this person is allowed to open for a kind of result; fall back to the explorer, which everyone has. */
const WHERE = {
  facility: ['/sustainability/boundary'],
  source: ['/sustainability/boundary', '/plant/fuels-energy'],
  entry: ['/sustainability/explorer'],
  supplier: ['/sustainability/value-chain'],
  target: ['/sustainability/targets'],
  factor: ['/sustainability/boundary']
};
export function useSearchTarget() {
  const { user, organization } = useAuth();
  const allowed = new Set(getNavItemsForUser({ ...user, organization }).map((i) => i.path));
  allowed.add('/sustainability/explorer');
  return (r) => (WHERE[r.kind] || []).find((p) => allowed.has(p)) || '/sustainability/explorer';
}

export function GlobalSearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query, 260);
  const ref = useRef(null);
  const navigate = useNavigate();
  const where = useSearchTarget();

  useEffect(() => {
    const out = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, []);

  useEffect(() => {
    if (debounced.trim().length < 2) { setResults([]); return undefined; }
    const c = new AbortController();
    setLoading(true);
    apiFetch(`/search?q=${encodeURIComponent(debounced.trim())}`, { signal: c.signal })
      .then((res) => { setResults(res.results || []); setOpen(true); })
      .catch((e) => { if (e.name !== 'AbortError') setResults([]); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [debounced]);

  const kinds = [...new Set(results.map((r) => r.kind))];
  const go = (path) => { setOpen(false); navigate(path); };

  return (
    <div ref={ref} className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 h-10 px-3 rounded-[10px] border border-line bg-white focus-within:ring-2 focus-within:ring-emerald-600/30">
        <Search className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
        <input
          value={query} aria-label="Search"
          onFocus={() => results.length > 0 && setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && query.trim().length >= 2) go(`/search?q=${encodeURIComponent(query.trim())}`); if (e.key === 'Escape') setOpen(false); }}
          placeholder="Search sites, meters, invoices, suppliers, factors…"
          className="flex-1 bg-transparent text-sm text-text placeholder:text-muted min-w-0 !outline-none !shadow-none !ring-0 !border-0"
        />
        {query && <button type="button" onClick={() => { setQuery(''); setResults([]); setOpen(false); }} className="text-muted hover:text-text" aria-label="Clear search"><X className="w-4 h-4" /></button>}
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-12 z-40 bg-white border border-line rounded-xl shadow-lg p-1.5 max-h-96 overflow-y-auto">
          {loading ? <div className="py-5 text-center text-sm text-muted">Searching…</div>
            : results.length === 0 ? <div className="py-5 text-center text-sm text-muted">Nothing found for “{query}”.</div>
            : <>
              {results.map((r) => (
                <button key={`${r.kind}-${r.id}`} type="button" onClick={() => go(where(r))} className="w-full px-3 py-2 rounded-lg text-left hover:bg-mist min-h-[44px]">
                  <div className="text-sm font-medium text-text truncate">{r.title}</div>
                  <div className="text-xs text-muted truncate">{r.type} · {r.subtitle}</div>
                </button>))}
              <button type="button" onClick={() => go(`/search?q=${encodeURIComponent(query.trim())}`)} className="w-full px-3 py-2 rounded-lg text-left text-sm font-medium text-emerald-700 hover:bg-mist min-h-[44px]">
                See all results{kinds.length > 1 ? '' : ''}
              </button>
            </>}
        </div>
      )}
    </div>
  );
}
