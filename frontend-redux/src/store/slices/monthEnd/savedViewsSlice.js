import { createSlice } from '@reduxjs/toolkit';

const KEY = 'tropos_explorer_views';
const saved = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

/** Emissions-explorer views a person saved. Kept in the browser (see store/index.js), not on the server. */
const savedViewsSlice = createSlice({
  name: 'savedViews',
  initialState: () => ({ views: saved() }),
  reducers: {
    viewSaved: (s, a) => { s.views = [...s.views.filter((x) => x.name !== a.payload.name), a.payload].slice(-12); },
    viewRemoved: (s, a) => { s.views = s.views.filter((x) => x.name !== a.payload); }
  }
});
export const { viewSaved, viewRemoved } = savedViewsSlice.actions;
export const selectSavedViews = (s) => s.savedViews.views;
export default savedViewsSlice.reducer;
