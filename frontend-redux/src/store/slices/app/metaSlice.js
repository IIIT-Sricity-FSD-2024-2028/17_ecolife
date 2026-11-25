import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /meta: public facts (states, trial days, units) and the choice lists. */
export const meta = createResourceSlice('meta');
export default meta.reducer;
