import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /internal-audit: read, create, update and delete go through this slice (see resourceSlice.js). */
export const internalAudit = createResourceSlice('internal-audit');
export default internalAudit.reducer;
