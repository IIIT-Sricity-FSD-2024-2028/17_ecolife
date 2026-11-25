import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { facilityChosen, periodChosen, selectScope } from '../../store/slices/app/scopeSlice';
import { Building2, CalendarDays } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { SelectField } from '../ui';
import { StatusBadge } from '../ui';

const KEY = 'tropos_scope';

/** Which site and month the person is working on. Remembered between pages and visits. Only sites they can use and months that accept data are offered. */
export function useReportingScope({ openOnly = true } = {}) {
  const { data: facilities } = useApi('/facilities');
  const { data: periods } = useApi('/periods');
  const dispatch = useDispatch();
  const { facilityId, periodId } = useSelector(selectScope);
  const setFacilityId = (id) => dispatch(facilityChosen(id));
  const setPeriodId = (id) => dispatch(periodChosen(id));

  const sites = useMemo(() => (facilities || []).filter((f) => !f.approvalStatus || f.approvalStatus === 'APPROVED'), [facilities]);
  const site = sites.find((x) => x.id === facilityId);
  // months the site was actually operating, newest first
  const months = useMemo(() => (periods || [])
    .filter((p) => !openOnly || ['OPEN', 'REOPENED'].includes(p.status))
    .filter((p) => !site || (new Date(p.endDate) >= new Date(site.effectiveFrom || 0) && (!site.effectiveTo || new Date(p.startDate) <= new Date(site.effectiveTo))))
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate))), [periods, openOnly, site]);

  useEffect(() => { if (sites.length && !sites.some((s) => s.id === facilityId)) setFacilityId(sites[0].id); }, [sites, facilityId]);
  useEffect(() => {
    if (months.length && !months.some((p) => p.id === periodId)) setPeriodId((months.find((p) => new Date(p.startDate) <= new Date()) || months[0]).id); // latest month that has started
  }, [months, periodId]);

  return { sites, months, facilityId, periodId, setFacilityId, setPeriodId, period: months.find((p) => p.id === periodId), loading: facilities === null || periods === null };
}

export function ScopeBar({ scope, hint }) {
  const { sites, months, facilityId, periodId, setFacilityId, setPeriodId, period } = scope;
  return (
    <div className="card px-4 py-3 mb-4 flex flex-wrap items-end gap-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted pb-2"><Building2 className="w-4 h-4" /><CalendarDays className="w-4 h-4 -ml-1" /></div>
      <SelectField className="min-w-[14rem] flex-1" label="Site" value={facilityId} onChange={setFacilityId} options={sites.map((s) => ({ value: s.id, label: s.name }))} />
      <SelectField className="min-w-[10rem]" label="Month" value={periodId} onChange={setPeriodId} options={months.map((p) => ({ value: p.id, label: p.label }))} />
      {period && <div className="pb-2"><StatusBadge status={period.status} /></div>}
      {hint && <p className="basis-full text-xs text-muted">{hint}</p>}
    </div>
  );
}
