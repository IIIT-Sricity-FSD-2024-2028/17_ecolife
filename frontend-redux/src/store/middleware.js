import { toastDismissed, toastPushed } from './slices/app/toastSlice';

/**
 * One place decides when the user sees a message:
 *  - a thunk that succeeded and was given `toast: '...'` shows that text,
 *  - a thunk the backend refused shows the backend's reason (unless it is a silent read).
 * Toasts remove themselves after a few seconds.
 */
export const toastMiddleware = (api) => (next) => (action) => {
  const result = next(action);
  if (typeof action.type !== 'string') return result;
  if (action.type.endsWith('/fulfilled') && action.meta?.arg?.toast) {
    api.dispatch(toastPushed(action.meta.arg.toast, 'success'));
  } else if (action.type.endsWith('/rejected') && action.payload && !action.payload.silent) {
    api.dispatch(toastPushed(action.payload.message, 'error'));
  } else if (toastPushed.match(action)) {
    const { id, variant } = action.payload;
    setTimeout(() => api.dispatch(toastDismissed(id)), variant === 'error' ? 8000 : 4500);
  }
  return result;
};
