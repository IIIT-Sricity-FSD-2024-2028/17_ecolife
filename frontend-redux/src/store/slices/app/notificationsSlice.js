import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /notifications: read, create, update and delete go through this slice (see resourceSlice.js). */
export const notifications = createResourceSlice('notifications');
export default notifications.reducer;
