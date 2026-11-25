import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /access-certifications: read, create, update and delete go through this slice (see resourceSlice.js). */
export const accessCertifications = createResourceSlice('access-certifications');
export default accessCertifications.reducer;
