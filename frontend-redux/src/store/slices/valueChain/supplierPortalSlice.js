import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /supplier-portal: read, create, update and delete go through this slice (see resourceSlice.js). */
export const supplierPortal = createResourceSlice('supplier-portal');
export default supplierPortal.reducer;
