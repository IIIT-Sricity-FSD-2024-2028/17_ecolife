import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /financial-metrics: read, create, update and delete go through this slice (see resourceSlice.js). */
export const financialMetrics = createResourceSlice('financial-metrics');
export default financialMetrics.reducer;
