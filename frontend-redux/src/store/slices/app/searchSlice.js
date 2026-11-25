import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /search: read, create, update and delete go through this slice (see resourceSlice.js). */
export const search = createResourceSlice('search');
export default search.reducer;
