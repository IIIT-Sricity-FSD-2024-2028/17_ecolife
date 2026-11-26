import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /explorer: read, create, update and delete go through this slice (see resourceSlice.js). */
export const explorer = createResourceSlice('explorer');
export default explorer.reducer;
