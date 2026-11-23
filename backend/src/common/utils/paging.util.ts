import { BadRequestException } from '@nestjs/common';

/** Hard ceiling for any list. No request, paged or not, can pull more rows than this in one go. */
export const MAX_PAGE_SIZE = 200;
/** Old clients that send no paging get at most this many rows, as a plain array (as before). */
export const LEGACY_CAP = 1000;

export interface Paging { paged: boolean; page: number; pageSize: number; skip: number; take: number }

function intParam(name: string, raw: unknown, min: number, max: number, dflt: number): number {
  if (raw === undefined || raw === null || raw === '') return dflt;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new BadRequestException(`${name} must be a whole number between ${min} and ${max}.`);
  return n;
}

/** page/pageSize are validated, never silently clamped, so a client bug shows up instead of hiding. */
export function parsePaging(q: { page?: unknown; pageSize?: unknown }): Paging {
  const paged = q.page !== undefined || q.pageSize !== undefined;
  if (!paged) return { paged: false, page: 1, pageSize: LEGACY_CAP, skip: 0, take: LEGACY_CAP };
  const pageSize = intParam('pageSize', q.pageSize, 1, MAX_PAGE_SIZE, 25);
  const page = intParam('page', q.page, 1, 1_000_000, 1);
  return { paged: true, page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** Paged callers get {items,total,...}; legacy callers keep receiving the bare array. */
export function pageResult<T>(p: Paging, items: T[], total: number) {
  if (!p.paged) return items;
  return { items, total, page: p.page, pageSize: p.pageSize, totalPages: Math.max(1, Math.ceil(total / p.pageSize)) };
}
