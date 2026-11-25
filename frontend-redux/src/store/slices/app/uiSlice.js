import { createSlice } from '@reduxjs/toolkit';

/** The app shell: the phone menu drawer, the account menu, and the one dialog that may be open. */
const uiSlice = createSlice({
  name: 'ui',
  initialState: { drawer: false, menu: false, dialog: null },
  reducers: {
    drawerSet: (s, a) => { s.drawer = a.payload; },
    menuSet: (s, a) => { s.menu = a.payload; },
    pageChanged: (s) => { s.drawer = false; s.menu = false; },
    // the dialog's words and fields only; the function that waits for the answer is kept outside the store (functions are not plain data)
    dialogOpened: (s, a) => { s.dialog = a.payload; },
    dialogClosed: (s) => { s.dialog = null; }
  }
});
export const { drawerSet, menuSet, pageChanged, dialogOpened, dialogClosed } = uiSlice.actions;
export const selectUi = (s) => s.ui;
export default uiSlice.reducer;
