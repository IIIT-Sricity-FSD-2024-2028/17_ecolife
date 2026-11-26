import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /actions: read, create, update and delete go through this slice (see resourceSlice.js). */
export const actions = createResourceSlice('actions');
export default actions.reducer;
