import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { signOut } from './slices/app/authSlice';
import app from './slices/app';
import workspace from './slices/workspace';
import dataCollection from './slices/dataCollection';
import monthEnd from './slices/monthEnd';
import { toastMiddleware } from './middleware';

/**
 * One reducer per backend resource. Each area keeps its slices in its own folder under ./slices and lists them in that folder's index.js,
 * so people working on different areas never edit the same line.
 */
const appReducer = combineReducers({ ...app, ...workspace, ...dataCollection, ...monthEnd });

/** Signing out empties every slice, so one company's data can never show to the next person. */
const rootReducer = (state, action) => appReducer(signOut.fulfilled.match(action) ? undefined : state, action);

export const store = configureStore({
  reducer: rootReducer,
  // file uploads travel as FormData inside an action; everything else in the store is plain data
  middleware: (getDefault) => getDefault({ serializableCheck: { ignoredActionPaths: ['meta.arg.form'] } }).concat(toastMiddleware),
  devTools: true
});

// Remember the chosen site/month and the saved explorer views between visits. Written here, after the reducers ran,
// so no component touches browser storage.
let last = {};
store.subscribe(() => {
  const { scope } = store.getState();
  if (scope !== last.scope && (scope.facilityId || scope.periodId)) { try { localStorage.setItem('tropos_scope', JSON.stringify(scope)); } catch { /* storage full or blocked */ } }
  last = { scope };
});
