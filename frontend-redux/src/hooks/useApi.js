import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getResource } from '../store/resourceSlice';

/**
 * Reads one backend path through the store. The reply is kept in the slice named after the path's first part
 * (/periods/... -> periods), so every page that asks for the same path shares one copy.
 * Returns { data, loading, error, refetch }. Pass null to skip.
 */
export function useApi(path) {
  const dispatch = useDispatch();
  const name = path ? path.split('?')[0].split('/')[1] : null;
  const res = name ? getResource(name) : null;
  if (path && !res) console.error(`No Redux slice is registered for ${path}`);
  const entry = useSelector((s) => (path && res ? s[name]?.cache[path] : undefined));
  const stale = Boolean(entry?.stale) && entry.status !== 'loading';

  useEffect(() => { if (path && res) dispatch(res.fetchData({ key: path })); }, [dispatch, path, res]);
  useEffect(() => { if (stale && res) dispatch(res.fetchData({ key: path, force: true })); }, [dispatch, stale, path, res]);
  const refetch = useCallback(() => { if (path && res) dispatch(res.fetchData({ key: path, force: true })); }, [dispatch, path, res]);

  return { data: entry?.data ?? null, loading: Boolean(path) && (!entry || entry.status === 'loading'), error: entry?.error || '', refetch };
}
