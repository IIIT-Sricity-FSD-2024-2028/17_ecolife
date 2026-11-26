import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /assurance: read, create, update and delete go through this slice (see resourceSlice.js). */
export const assurance = createResourceSlice('assurance');
export default assurance.reducer;
