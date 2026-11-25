import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { useForm } from '../../hooks/useForm';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../context/AuthContext';
import { getNavItemsForUser } from '../../app/navigation';

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
  const f = useForm('global-search', { query: '', open: false });
  const { query, open } = f.values;
  const setQuery = (v) => f.set('query', v);
  const setOpen = (v) => f.set('open', v);
  const debounced = useDebounce(query, 260);
  const ref = useRef(null);
  const navigate = useNavigate();
  const where = useSearchTarget();

  useEffect(() => {
    const out = (e) => { if (ref.current && !ref.current.contains(e.target)) f.set('open', false); };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the matches are read through the store; the drop-down opens when a search for the typed words has an answer
  const wanted = debounced.trim().length >= 2;
  const found = useApi(wanted ? `/search?q=${encodeURIComponent(debounced.trim())}` : null);
  const results = wanted ? (found.data?.results || []) : [];
  const loading = wanted && found.loading;
  useEffect(() => { if (wanted && found.data) f.set('open', true); }, [wanted, found.data]); // eslint-disable-line react-hooks/exhaustive-deps

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
        {query && <button type="button" onClick={() => { f.patch({ query: '', open: false }); }} className="text-muted hover:text-text" aria-label="Clear search"><X className="w-4 h-4" /></button>}
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
