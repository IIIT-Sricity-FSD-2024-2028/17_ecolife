import { createSlice, nanoid } from '@reduxjs/toolkit';

/** Messages shown at the bottom right. Replaces the old ToastContext. */
const toastSlice = createSlice({
  name: 'toasts',
  initialState: { items: [] },
  reducers: {
    toastPushed: {
      reducer(state, action) { state.items.push(action.payload); },
      prepare(message, variant = 'success') { return { payload: { id: nanoid(), message, variant } }; }
    },
    toastDismissed(state, action) { state.items = state.items.filter((t) => t.id !== action.payload); }
  }
});

export const { toastPushed, toastDismissed } = toastSlice.actions;
export const selectToasts = (s) => s.toasts.items;
export default toastSlice.reducer;
