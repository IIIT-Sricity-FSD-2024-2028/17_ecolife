import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /supplier-requests: read, create, update and delete go through this slice (see resourceSlice.js). */
export const supplierRequests = createResourceSlice('supplier-requests');
export default supplierRequests.reducer;
