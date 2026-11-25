import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /facilities: read, create, update and delete go through this slice (see resourceSlice.js). */
export const facilities = createResourceSlice('facilities');
export default facilities.reducer;
