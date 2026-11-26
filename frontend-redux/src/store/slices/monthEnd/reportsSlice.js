import { createResourceSlice, markStale } from '../../resourceSlice';

/**
 * Backend resource /reports. Downloading a report is a file download (not a JSON write), so the page
 * tells the store with `reportsRefreshed` that the history list has a new row and must be read again.
 */
export const reports = createResourceSlice('reports', { reducers: { reportsRefreshed: markStale } });
export const { reportsRefreshed } = reports.actions;
export default reports.reducer;
