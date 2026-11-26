import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /analytics: the numbers behind each role's dashboard. Read only, so only the read side is used. */
export const analytics = createResourceSlice('analytics');
export default analytics.reducer;
