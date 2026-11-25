import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /resources: read, create, update and delete go through this slice (see resourceSlice.js). */
export const resources = createResourceSlice('resources');
export default resources.reducer;
