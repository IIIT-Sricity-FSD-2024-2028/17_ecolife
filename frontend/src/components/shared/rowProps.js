/**
 * Props that make a table row open its detail view with the mouse or the
 * keyboard (Enter / Space), with a focus ring via `.clickable-row:focus-visible`.
 * Usage: <tr {...rowProps(() => setSelected(item))}>
 */
export const rowProps = (onOpen) => ({
  className: 'clickable-row',
  tabIndex: 0,
  role: 'button',
  onClick: onOpen,
  onKeyDown: (e) => {
    if (e.target !== e.currentTarget) return; // ignore keys pressed inside buttons/links in the row
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  },
});
