import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /imp: read, create, update and delete go through this slice (see resourceSlice.js). */
export const imp = createResourceSlice('imp');
export default imp.reducer;
