import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /billing: read, create, update and delete go through this slice (see resourceSlice.js). */
export const billing = createResourceSlice('billing');
export default billing.reducer;
