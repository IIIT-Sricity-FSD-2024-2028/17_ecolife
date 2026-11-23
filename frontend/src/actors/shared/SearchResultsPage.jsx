import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../services/apiClient';
import { useSearchTarget } from '../../components/common/GlobalSearchBar';
import { Card, EmptyState, PageHeader } from '../../components/ui';

const KINDS = [['facility', 'Sites'], ['source', 'Meters and fuels'], ['entry', 'Entries'], ['supplier', 'Suppliers'], ['target', 'Targets'], ['factor', 'Emission factors']];

export default function SearchResultsPage() {
  const [sp] = useSearchParams();
  const q = (sp.get('q') || '').trim();
  const navigate = useNavigate();
  const where = useSearchTarget();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (q.length < 2) { setData({ results: [] }); return undefined; }
    let on = true; setData(null); setErr('');
    apiFetch(`/search?q=${encodeURIComponent(q)}&limit=50`).then((d) => on && setData(d)).catch((e) => on && setErr(e.message));
    return () => { on = false; };
  }, [q]);

  const groups = KINDS.map(([k, label]) => [label, (data?.results || []).filter((r) => r.kind === k)]).filter(([, rows]) => rows.length);

  return (
    <div className="max-w-3xl">
      <PageHeader title={q ? `Results for “${q}”` : 'Search'} description="Up to 50 matches in each group." />
      {err && <p className="text-sm text-red-700">{err}</p>}
      {!data && !err && <div className="h-24 animate-pulse bg-mist rounded-xl" />}
      {data && groups.length === 0 && <EmptyState title={q.length < 2 ? 'Type at least two letters' : 'Nothing found'}>{q.length < 2 ? 'Use the search box at the top.' : 'Try a shorter word, a meter number or an invoice number.'}</EmptyState>}
      {groups.map(([label, rows]) => (
        <Card key={label} title={label} description={`${rows.length}${rows.length === 50 ? ' or more' : ''}`} padded={false} className="mb-4">
          <ul className="divide-y divide-line">{rows.map((r) => (
            <li key={`${r.kind}-${r.id}`}><Link to={where(r)} className="block px-5 py-3 hover:bg-mist min-h-[44px]"><div className="font-medium text-text">{r.title}</div><div className="text-sm text-muted">{r.subtitle}</div></Link></li>))}</ul>
        </Card>
      ))}
    </div>
  );
}
