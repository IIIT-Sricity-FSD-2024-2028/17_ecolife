import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /green-economy: read, create, update and delete go through this slice (see resourceSlice.js). */
export const greenEconomy = createResourceSlice('green-economy');
export default greenEconomy.reducer;
