import { createSlice } from '@reduxjs/toolkit';

const KEY = 'tropos_scope';
const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

/** The site and month the person is working on. Shared by every data page; remembered between visits (see useReportingScope). */
const scopeSlice = createSlice({
  name: 'scope',
  initialState: () => ({ facilityId: saved().facilityId || '', periodId: saved().periodId || '' }),
  reducers: {
    facilityChosen: (s, a) => { s.facilityId = a.payload; },
    periodChosen: (s, a) => { s.periodId = a.payload; }
  }
});
export const { facilityChosen, periodChosen } = scopeSlice.actions;
export const selectScope = (s) => s.scope;
export default scopeSlice.reducer;
