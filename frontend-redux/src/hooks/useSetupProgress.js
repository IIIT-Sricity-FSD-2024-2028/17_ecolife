import { useAuth } from '../context/AuthContext';
import { useApi } from './useApi';
import { getNavItemsForUser } from '../app/navigation';

/** Steps are worked out from what is really saved, so the list can never disagree with the data. */
export function useSetupProgress() {
  const { user, organization } = useAuth();
  const canSetUp = (user?.roles || []).some((r) => ['ORG_ADMIN', 'SUSTAINABILITY_LEAD'].includes(r));
  const fac = useApi(canSetUp ? '/facilities' : null);
  const src = useApi(canSetUp ? '/sources?page=1&pageSize=1' : null);
  const per = useApi(canSetUp ? '/periods' : null);
  const team = useApi(canSetUp ? '/team' : null);
  const loading = canSetUp && [fac, src, per, team].some((x) => x.loading);
  const people = (team.data?.users || []).filter((m) => m.isActive).length;
  const steps = [
    { key: 'track', title: 'Choose what to track', done: Array.isArray(organization?.enabledModules) && organization.enabledModules.length > 0, text: 'Tick the areas that apply to your company: fuel, electricity, water, waste and so on. Menus show only these.', path: '/admin/settings', action: 'Choose' },
    { key: 'people', title: 'Decide who enters and who approves', done: people >= 2 || Boolean(organization?.allowSingleUserMode), text: 'Add a second person to approve entries, or choose single-person mode if you are the only user.', path: '/admin/team', action: 'Add people' },
    { key: 'sites', title: 'Add your sites', done: (fac.data || []).length > 0, text: 'Plants, offices and warehouses that use energy or make emissions.', path: '/sustainability/boundary', action: 'Add a site' },
    { key: 'meters', title: 'Add meters and fuels', done: (src.data?.total ?? 0) > 0, text: 'Each electricity meter, fuel tank or water connection you will record every month.', path: '/sustainability/boundary', action: 'Add a meter' },
    { key: 'months', title: 'Open the months of the year', done: (per.data || []).length > 0, text: 'Opens twelve months so entries have somewhere to go.', path: '/sustainability/close', action: 'Open months' }
  ];
  const allowed = new Set(getNavItemsForUser({ ...user, organization }).map((i) => i.path));
  return { canSetUp, loading, steps: steps.map((s) => ({ ...s, canOpen: allowed.has(s.path) })), complete: steps.every((s) => s.done) };
}

