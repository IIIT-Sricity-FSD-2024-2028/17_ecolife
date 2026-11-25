import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { getResource } from '../store/resourceSlice';

/**
 * Saves something through the store. The write goes to the slice named after the path (/periods/abc/close -> periods).
 *   const act = useAction();
 *   const saved = await act({ path: '/periods/abc/close', method: 'POST', toast: 'Month closed.' });
 * `method: "GET", silent: true` reads once without showing errors (used to peek before a confirmation).
 * Returns the backend's reply, or undefined if the backend refused (the reason is shown as a toast by the store
 * and nothing in the store changes). `toast` is the success message. Pass `form` (FormData) for file uploads.
 */
export function useAction() {
  const dispatch = useDispatch();
  return useCallback(async ({ path, ...rest }) => {
    const res = getResource(path.split('?')[0].split('/')[1]);
    if (!res) { console.error(`No Redux slice is registered for ${path}`); return undefined; }
    const r = await dispatch(res.send({ path, ...rest }));
    return r.error ? undefined : (r.payload ?? {});
  }, [dispatch]);
}
