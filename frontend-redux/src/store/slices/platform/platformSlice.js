import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /platform: read, create, update and delete go through this slice (see resourceSlice.js). */
export const platform = createResourceSlice('platform');
export default platform.reducer;
