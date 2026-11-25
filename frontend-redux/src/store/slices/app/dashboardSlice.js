import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /dashboard: read, create, update and delete go through this slice (see resourceSlice.js). */
export const dashboard = createResourceSlice('dashboard');
export default dashboard.reducer;
