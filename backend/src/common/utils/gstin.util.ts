const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SHAPE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
// GST state / UT codes in use (01-38, 97 other territory, 99 centre jurisdiction).
const STATE_OK = (c: number) => (c >= 1 && c <= 38) || c === 97 || c === 99;

/** A GSTIN's 15th character is a mod-36 check digit over the first 14 (as published by GSTN). */
export function isValidGstin(raw: string): boolean {
  const g = raw.trim().toUpperCase();
  if (!SHAPE.test(g) || !STATE_OK(Number(g.slice(0, 2)))) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = CHARSET.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36] === g[14];
}
