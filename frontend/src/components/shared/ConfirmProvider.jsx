import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

const ConfirmContext = createContext(null);

/**
 * Promise-based confirmation, so any handler can guard an action in one line:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete?', message: '…', danger: true }))) return;
 *
 * Resolves true on confirm, false on cancel / Escape / backdrop click.
 */
export function ConfirmProvider({ children }) {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setOptions(opts);
      }),
    [],
  );

  const settle = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!options}
        title={options?.title}
        message={options?.message}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        danger={options?.danger}
        icon={options?.icon}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
