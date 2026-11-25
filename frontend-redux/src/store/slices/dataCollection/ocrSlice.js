import { createResourceSlice } from '../../resourceSlice';

/** Backend resource /ocr: read, create, update and delete go through this slice (see resourceSlice.js). */
export const ocr = createResourceSlice('ocr');
export default ocr.reducer;
