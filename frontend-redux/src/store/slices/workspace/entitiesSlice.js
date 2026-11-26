import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /entities: read, create, update and delete go through this slice (see resourceSlice.js). */
export const entities = createResourceSlice('entities');
export default entities.reducer;
