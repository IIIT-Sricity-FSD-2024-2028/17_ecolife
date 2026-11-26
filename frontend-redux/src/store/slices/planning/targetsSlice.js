import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /targets: read, create, update and delete go through this slice (see resourceSlice.js). */
export const targets = createResourceSlice('targets');
export default targets.reducer;
