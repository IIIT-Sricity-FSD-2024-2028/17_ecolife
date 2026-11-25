import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /email-outbox: read, create, update and delete go through this slice (see resourceSlice.js). */
export const emailOutbox = createResourceSlice('email-outbox');
export default emailOutbox.reducer;
