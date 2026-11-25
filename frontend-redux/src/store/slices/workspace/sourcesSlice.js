import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /sources: read, create, update and delete go through this slice (see resourceSlice.js). */
export const sources = createResourceSlice('sources');
export default sources.reducer;
