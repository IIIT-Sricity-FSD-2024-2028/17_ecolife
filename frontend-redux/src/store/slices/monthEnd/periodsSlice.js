import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /periods: read, create, update and delete go through this slice (see resourceSlice.js). */
export const periods = createResourceSlice('periods');
export default periods.reducer;
