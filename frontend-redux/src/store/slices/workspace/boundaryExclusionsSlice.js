import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /boundary-exclusions: read, create, update and delete go through this slice (see resourceSlice.js). */
export const boundaryExclusions = createResourceSlice('boundary-exclusions');
export default boundaryExclusions.reducer;
