export function fmtInr(v) {
  const n = Number(v ?? 0);
  const sign = n < 0 ? '−' : '';
  return `${sign}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;
}

/** Exact rupees and paise, for invoices and payments where every paisa must match the bill. */
export function fmtInrExact(v) {
  const n = Number(v ?? 0);
  return `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtNum(v, digits = 2) {
  return Number(v ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/** Rupees in the units people say aloud: 4.5 lakh, 12 crore. For chart axes and tight spaces. */
export function fmtInrShort(v) {
  const n = Number(v ?? 0);
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  const trim = (x) => String(Number(x.toFixed(1)));
  if (a >= 1e7) return `${sign}₹${trim(a / 1e7)} cr`;
  if (a >= 1e5) return `${sign}₹${trim(a / 1e5)} lakh`;
  if (a >= 1e3) return `${sign}₹${trim(a / 1e3)}k`;
  return `${sign}₹${Math.round(a)}`;
}
