import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /scope3-purchases: read, create, update and delete go through this slice (see resourceSlice.js). */
export const scope3Purchases = createResourceSlice('scope3-purchases');
export default scope3Purchases.reducer;
