import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /recalculations: read, create, update and delete go through this slice (see resourceSlice.js). */
export const recalculations = createResourceSlice('recalculations');
export default recalculations.reducer;
