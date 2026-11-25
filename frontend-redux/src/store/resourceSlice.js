import { createAction, createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { apiFetch } from '../services/apiClient';

/**
 * One Redux slice per backend resource (periods, facilities, entries, billing ...).
 * A slice is named after the first part of its backend path, so '/periods/abc/readiness' belongs to `periods`.
 *
 * What every resource slice has:
 *   cache         the replies the backend gave, one per path asked, with status (loading / ready / failed)
 *   fetchData     READ    GET     asks the backend and stores the reply
 *   send          WRITE   POST / PATCH / PUT / DELETE; the store changes only if the backend says yes
 *   create / update / remove   the same `send`, spelled as CRUD: POST /base, PATCH /base/:id, DELETE /base/:id
 *
 * After any successful write every cached reply is marked stale, so each page on screen re-reads the saved
 * records from the backend and shows exactly what is in the database.
 */
const registry = new Map();
export const getResource = (name) => registry.get(name);
export const resourceNames = () => [...registry.keys()];

export const markStale = (s) => { Object.values(s.cache).forEach((e) => { e.stale = true; }); };

export function createResourceSlice(name, extra = {}) {
  const base = `/${name}`;

  const fetchData = createAsyncThunk(
    `${name}/fetch`,
    async ({ key }, { rejectWithValue, signal }) => {
      try { return await apiFetch(key, { signal }); }
      catch (e) { return rejectWithValue({ message: e.message || 'Could not load this.', status: e.status || 0, silent: true }); }
    },
    // do not ask twice for the same path while the first answer is still on its way
    { condition: ({ key, force }, { getState }) => force || getState()[name].cache[key]?.status !== 'loading' }
  );

  const send = createAsyncThunk(`${name}/send`, async ({ path, method = 'POST', body, form, silent }, { rejectWithValue }) => {
    try { return await apiFetch(path, { method, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) }); }
    catch (e) { return rejectWithValue({ message: e.message || 'Something went wrong.', status: e.status || 0, details: e.details, silent: !!silent }); }
  });

  const slice = createSlice({
    name,
    initialState: { cache: {}, ...(extra.initialState || {}) },
    reducers: extra.reducers || {},
    extraReducers: (b) => {
      b.addCase(fetchData.pending, (s, a) => {
        const e = (s.cache[a.meta.arg.key] ??= { status: 'loading', data: null, error: '', stale: false });
        e.status = 'loading'; e.error = ''; e.stale = false;
      });
      b.addCase(fetchData.fulfilled, (s, a) => { const e = s.cache[a.meta.arg.key]; if (e) { e.status = 'ready'; e.data = a.payload; } });
      b.addCase(fetchData.rejected, (s, a) => { const e = s.cache[a.meta.arg.key]; if (e) { e.status = 'failed'; e.error = a.payload?.message || a.error?.message || 'Could not load this.'; } });
      extra.extraReducers?.(b);
      // a write to ANY resource may change what this one shows, so every slice marks its replies stale
      b.addMatcher((a) => typeof a.type === 'string' && a.type.endsWith('/send/fulfilled') && a.meta?.arg?.method !== 'GET', markStale);
    }
  });

  const resource = {
    name, base, slice, reducer: slice.reducer, actions: slice.actions, fetchData, send,
    create: (body, opts = {}) => send({ path: base, method: 'POST', body, ...opts }),
    update: (id, body, opts = {}) => send({ path: `${base}/${id}`, method: 'PATCH', body, ...opts }),
    remove: (id, opts = {}) => send({ path: `${base}/${id}`, method: 'DELETE', ...opts }),
    selectCache: (key) => (s) => s[name].cache[key]
  };
  registry.set(name, resource);
  return resource;
}
