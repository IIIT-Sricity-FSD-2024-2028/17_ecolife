import { isAfter, isBefore, isEqual } from 'date-fns';
import { DataStore, EmissionFactorVersion } from '../database/types';

export interface FactorResolution {
  rows: EmissionFactorVersion[];
  scope: 'ORG_OVERRIDE' | 'GLOBAL' | 'NONE';
}

/**
 * Which emission-factor rows apply to a record: the organization's own
 * override(s) if any are effective on the period start, otherwise the
 * global defaults. Shared by the calculation engine and the read models
 * so the lineage a user sees is exactly what the maths used.
 */
export function resolveFactors(
  store: DataStore,
  record: { resourceTypeId: string; organizationId: string; periodStart: string },
): FactorResolution {
  const periodStart = new Date(record.periodStart);
  const startedBy = (iso: string) => {
    const d = new Date(iso);
    return isBefore(d, periodStart) || isEqual(d, periodStart);
  };
  const notEndedBefore = (iso: string | null) => {
    if (iso === null) return true;
    const d = new Date(iso);
    return isAfter(d, periodStart) || isEqual(d, periodStart);
  };

  const applicable = (orgScoped: boolean) =>
    store.emissionFactorVersions.filter(
      (f) =>
        f.resourceTypeId === record.resourceTypeId &&
        (orgScoped ? f.organizationId === record.organizationId : f.organizationId === null) &&
        startedBy(f.effectiveFrom) &&
        notEndedBefore(f.effectiveTo),
    );

  const org = applicable(true);
  if (org.length > 0) return { rows: org, scope: 'ORG_OVERRIDE' };
  const global = applicable(false);
  return { rows: global, scope: global.length > 0 ? 'GLOBAL' : 'NONE' };
}
