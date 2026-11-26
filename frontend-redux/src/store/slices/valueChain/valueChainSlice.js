import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /value-chain: read, create, update and delete go through this slice (see resourceSlice.js). */
export const valueChain = createResourceSlice('value-chain');
export default valueChain.reducer;
