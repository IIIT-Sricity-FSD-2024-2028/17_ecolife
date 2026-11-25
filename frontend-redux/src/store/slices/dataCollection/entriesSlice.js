import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /entries: read, create, update and delete go through this slice (see resourceSlice.js). */
export const entries = createResourceSlice('entries');
export default entries.reducer;
