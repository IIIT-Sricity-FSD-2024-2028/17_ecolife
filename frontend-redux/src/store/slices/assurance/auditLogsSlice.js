import { createResourceSlice } from '../../resourceSlice';

/** /audit-logs: the append-only activity trail. Read-only by design (nothing in an audit log can be edited or deleted). */
export default createResourceSlice('audit-logs').reducer;
