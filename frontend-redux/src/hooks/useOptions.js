import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOptions, selectOptions } from '../store/slices/app/optionsSlice';

/** Choice lists come from the backend (GET /meta/options); loaded once per session into the options slice. */
export function useOptions() {
  const dispatch = useDispatch();
  const opts = useSelector(selectOptions);
  useEffect(() => { dispatch(fetchOptions()); }, [dispatch]);
  return { enums: opts?.enums || {}, rules: opts?.rules || {}, ready: Boolean(opts) };
}

/** [{value,label}] for a SelectField, with labels in everyday words. */
export const toOptions = (values = [], labels = {}) => values.map((v) => ({ value: v, label: labels[v] || String(v).toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) }));
