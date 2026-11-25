import { useEffect, useId } from 'react';
import { useForm } from './useForm';

/** The value, delayed. The delayed copy lives in the store's forms slice and is set by a reducer. */
export function useDebounce(value, delayMs = 280) {
  const f = useForm(`debounce-${useId()}`, { v: value });
  useEffect(() => {
    const id = setTimeout(() => f.set('v', value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return f.values.v;
}
