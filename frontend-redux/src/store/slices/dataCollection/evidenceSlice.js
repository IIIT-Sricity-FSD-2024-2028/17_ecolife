import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /evidence: read, create, update and delete go through this slice (see resourceSlice.js). */
export const evidence = createResourceSlice('evidence');
export default evidence.reducer;
