import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /sessions: read, create, update and delete go through this slice (see resourceSlice.js). */
export const sessions = createResourceSlice('sessions');
export default sessions.reducer;
