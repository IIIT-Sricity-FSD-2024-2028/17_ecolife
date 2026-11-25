import { createSlice } from '@reduxjs/toolkit';
import { apiThunk } from '../../apiThunk';

/** Choice lists and rules come from the backend (GET /meta/options) and are loaded once per session. */
export const fetchOptions = apiThunk('options/fetch', () => ({ path: '/meta/options' }), {
  silent: true,
  condition: (_, { getState }) => getState().options.status === 'idle'
});

const slice = createSlice({
  name: 'options',
  initialState: { status: 'idle', data: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchOptions.pending, (s) => { s.status = 'loading'; });
    b.addCase(fetchOptions.fulfilled, (s, a) => { s.status = 'ready'; s.data = a.payload; });
    b.addCase(fetchOptions.rejected, (s) => { s.status = 'idle'; });
  }
});

export const selectOptions = (s) => s.options.data;
export default slice.reducer;
