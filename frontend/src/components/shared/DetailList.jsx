/** Label/value grid used by every detail drawer. Items with an empty value show an em dash. */
export function DetailList({ items }) {
  return (
    <dl className="kv">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value === null || value === undefined || value === '' ? '—' : value}</dd>
        </div>
      ))}
    </dl>
  );
}
