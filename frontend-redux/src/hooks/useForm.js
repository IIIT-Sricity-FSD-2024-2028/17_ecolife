import { useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fieldChanged, formPatched, formRemoved, formReset } from '../store/slices/app/formsSlice';

/**
 * The page's own fields and flags, held in the store's `forms` slice and changed by reducers.
 *   const f = useForm('login', { email: '', password: '' });
 *   f.values.email        read a value
 *   f.set('email', v)     change one field        f.patch({ busy: true })   change several
 *   f.reset()             back to the start       <TextField {...f.field('email')} />
 */
export function useForm(id, initial) {
  const dispatch = useDispatch();
  const start = useRef(initial);
  const stored = useSelector((s) => s.forms[id]);
  const values = stored ?? start.current;
  useEffect(() => () => { dispatch(formRemoved(id)); }, [dispatch, id]);
  const api = useMemo(() => ({
    set: (field, value) => dispatch(fieldChanged({ id, field, value, initial: start.current })),
    patch: (patch) => dispatch(formPatched({ id, patch, initial: start.current })),
    reset: (v) => dispatch(formReset({ id, values: v ?? start.current })),
    field: (name) => ({ value: undefined, onChange: (v) => dispatch(fieldChanged({ id, field: name, value: v, initial: start.current })) })
  }), [dispatch, id]);
  return { values, set: api.set, patch: api.patch, reset: api.reset, field: (name) => ({ ...api.field(name), value: values[name] }) };
}
