import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /scope2-instruments: read, create, update and delete go through this slice (see resourceSlice.js). */
export const scope2Instruments = createResourceSlice('scope2-instruments');
export default scope2Instruments.reducer;
