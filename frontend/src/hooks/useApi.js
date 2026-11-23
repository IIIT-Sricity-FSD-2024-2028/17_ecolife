import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../services/apiClient';

/**
 * Custom data-fetching hook with AbortController cleanup to prevent memory leaks and stale races.
 */
export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    apiFetch(path, { signal: controller.signal })
      .then((res) => setData(res))
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Failed to load data');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { data, loading, error, refetch, setData };
}
