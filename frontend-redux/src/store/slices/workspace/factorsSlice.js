import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /factors: read, create, update and delete go through this slice (see resourceSlice.js). */
export const factors = createResourceSlice('factors');
export default factors.reducer;
