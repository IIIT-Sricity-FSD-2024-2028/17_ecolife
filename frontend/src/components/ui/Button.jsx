import { Loader2 } from 'lucide-react';
import './ui.css';

/**
 * Shared Button — every button in the app renders through this one
 * component so size/color/disabled/loading states stay consistent.
 * Pass a lucide icon component via `icon` to show it before the label.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  onClick,
  fullWidth = false,
  icon: Icon,
  title,
}) {
  const iconSize = size === 'sm' ? 14 : 16;
  return (
    <button
      type={type}
      title={title}
      className={`btn btn--${variant} btn--${size}${fullWidth ? ' btn--full' : ''}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? (
        <>
          <Loader2 size={iconSize} className="icon-spin" aria-hidden="true" />
          Please wait…
        </>
      ) : (
        <>
          {Icon && <Icon size={iconSize} aria-hidden="true" />}
          {children}
        </>
      )}
    </button>
  );
}

