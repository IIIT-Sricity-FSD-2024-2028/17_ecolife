import { createSlice } from '@reduxjs/toolkit';

/**
 * Everything a person types or opens on a page (form fields, dialogs, tabs, filters) lives here,
 * changed only by these reducers. This replaces React's useState across the app.
 * Each form has an id; it is removed again when the page closes, so a new visit starts empty.
 */
const slice = createSlice({
  name: 'forms',
  initialState: {},
  reducers: {
    fieldChanged(state, { payload: { id, field, value, initial } }) { state[id] = { ...(state[id] ?? initial), [field]: value }; },
    formPatched(state, { payload: { id, patch, initial } }) { state[id] = { ...(state[id] ?? initial), ...patch }; },
    formReset(state, { payload: { id, values } }) { state[id] = { ...values }; },
    formRemoved(state, { payload }) { delete state[payload]; }
  }
});

export const { fieldChanged, formPatched, formReset, formRemoved } = slice.actions;
export const selectForm = (id) => (s) => s.forms[id];
export default slice.reducer;
