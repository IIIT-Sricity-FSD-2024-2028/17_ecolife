/**
 * Fiscal-year helpers. All dates are UTC midnight so a period never shifts by a day with the server's timezone.
 * India's statutory financial year starts in April (fyStartMonth = 4) but each organization stores its own.
 */
export function fyStartYearFor(year: number, month: number, fyStartMonth: number): number {
  return month >= fyStartMonth ? year : year - 1;
}

export function fyLabel(startYear: number, fyStartMonth = 4): string {
  // A year that starts in January (fyStartMonth = 1) is a calendar year, labelled by that year alone.
  if (fyStartMonth === 1) return `FY${startYear}`;
  return `FY${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function fyLabelFor(year: number, month: number, fyStartMonth: number): string {
  return fyLabel(fyStartYearFor(year, month, fyStartMonth), fyStartMonth);
}

export function monthStartUtc(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

export function monthEndUtc(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function periodLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

/** First day of the financial year that contains the given month. */
export function fyStartDateUtc(year: number, month: number, fyStartMonth: number): Date {
  return new Date(Date.UTC(fyStartYearFor(year, month, fyStartMonth), fyStartMonth - 1, 1));
}

export function periodRow(orgId: string, year: number, month: number, fyStartMonth: number) {
  return {
    organizationId: orgId,
    financialYear: fyLabelFor(year, month, fyStartMonth),
    month,
    label: periodLabel(year, month),
    startDate: monthStartUtc(year, month),
    endDate: monthEndUtc(year, month),
    status: 'OPEN' as const
  };
}
