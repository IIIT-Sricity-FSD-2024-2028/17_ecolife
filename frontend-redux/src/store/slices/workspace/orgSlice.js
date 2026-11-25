import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /org: read, create, update and delete go through this slice (see resourceSlice.js). */
export const org = createResourceSlice('org');
export default org.reducer;
