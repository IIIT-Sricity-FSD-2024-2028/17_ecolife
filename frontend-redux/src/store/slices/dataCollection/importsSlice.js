import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /imports: read, create, update and delete go through this slice (see resourceSlice.js). */
export const imports = createResourceSlice('imports');
export default imports.reducer;
