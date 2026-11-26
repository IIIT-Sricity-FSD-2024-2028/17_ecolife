import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /suppliers: read, create, update and delete go through this slice (see resourceSlice.js). */
export const suppliers = createResourceSlice('suppliers');
export default suppliers.reducer;
