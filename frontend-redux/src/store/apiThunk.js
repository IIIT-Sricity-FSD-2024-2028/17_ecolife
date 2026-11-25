import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiFetch } from '../services/apiClient';

/**
 * The one way every slice talks to the backend (the "thunk pattern").
 *
 *   build(arg) -> { path, method?, body? }   what to send
 *   options.silent   read thunks: the page shows the error itself, so no toast
 *
 * The thunk resolves with the backend's reply only when the backend said yes.
 * If the backend refuses, it rejects with { message, status, details } and the store is left as it was,
 * so a slice only ever changes from a reply that really was saved.
 * `arg.toast` is shown by the toast middleware after a successful save.
 */
export function apiThunk(type, build, options = {}) {
  return createAsyncThunk(
    type,
    async (arg, { rejectWithValue, signal }) => {
      try {
        const { path, method = 'GET', body } = build(arg);
        return await apiFetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body), signal });
      } catch (e) {
        return rejectWithValue({ message: e.message || 'Something went wrong.', status: e.status || 0, details: e.details, silent: Boolean(options.silent) || e.name === 'AbortError' });
      }
    },
    options.condition ? { condition: options.condition } : undefined
  );
}

/** Reads the readable message out of a rejected thunk action. */
export const errorOf = (action) => action.payload?.message || action.error?.message || 'Something went wrong.';
