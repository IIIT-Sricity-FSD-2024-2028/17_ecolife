import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ClipboardCheck, FilePenLine, FileText, Building2, CreditCard, Wrench, Layers } from 'lucide-react';
import { alertsService } from '../services/miscServices';
import { reportsService } from '../services/reportsService';
import { amendmentsService } from '../services/analyticsService';
import { platformAdminService } from '../services/platformAdminService';
import { ORG_ROLES } from '../constants/roles';
import { ADMIN_ROUTES, CONTRIBUTOR_ROUTES, EXECUTIVE_ROUTES, ORG_ADMIN_ROUTES, REVIEWER_ROUTES } from '../constants/routes';

const ALERT_ROUTE = {
  [ORG_ROLES.CONTRIBUTOR]: CONTRIBUTOR_ROUTES.ALERTS,
  [ORG_ROLES.REVIEWER]: REVIEWER_ROUTES.ALERTS,
  [ORG_ROLES.ORG_ADMIN]: ORG_ADMIN_ROUTES.ALERTS,
  [ORG_ROLES.EXECUTIVE]: EXECUTIVE_ROUTES.HOME,
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Notifications are derived from what currently needs the person's attention
 * (open alerts, items awaiting a decision, platform warnings) using the same
 * queries the dashboards already run, so the badge always matches the pages
 * it links to and needs no separate "read" bookkeeping.
 *
 * Returns { items: [{ id, icon, text, detail?, to, count }], count, isLoading }.
 */
export function useNotifications({ portal, role }) {
  const isAdmin = portal === 'admin';
  const isExec = role === ORG_ROLES.EXECUTIVE;

  const alerts = useQuery({ queryKey: ['alerts'], queryFn: alertsService.list, enabled: !isAdmin });
  const reports = useQuery({ queryKey: ['reports'], queryFn: reportsService.list, enabled: !isAdmin && isExec });
  const amendments = useQuery({ queryKey: ['amendments'], queryFn: amendmentsService.list, enabled: !isAdmin && isExec });
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: platformAdminService.overview, enabled: isAdmin });

  const items = [];

  if (isAdmin) {
    const o = overview.data;
    if (o) {
      if (o.system?.maintenanceMode) items.push({ id: 'maintenance', icon: Wrench, text: 'Maintenance mode is on', detail: 'Organization users are blocked.', to: ADMIN_ROUTES.SETTINGS, count: 1 });
      const types = o.factors?.typesWithoutFactor ?? [];
      if (types.length) items.push({ id: 'factors', icon: Layers, text: `${plural(types.length, 'resource type')} without a global factor`, detail: types.join(', '), to: ADMIN_ROUTES.RESOURCES, count: types.length });
      const suspended = o.organizations?.byStatus?.SUSPENDED ?? 0;
      if (suspended) items.push({ id: 'suspended', icon: Building2, text: `${plural(suspended, 'suspended organization')}`, to: ADMIN_ROUTES.ORGANIZATIONS, count: suspended });
      const pastDue = o.subscriptions?.byStatus?.PAST_DUE ?? 0;
      if (pastDue) items.push({ id: 'pastdue', icon: CreditCard, text: `${plural(pastDue, 'subscription')} past due`, to: ADMIN_ROUTES.REVENUE, count: pastDue });
    }
  } else {
    const open = (alerts.data ?? []).filter((a) => a.status === 'OPEN');
    if (isExec) {
      const pr = (reports.data ?? []).filter((r) => r.status === 'PENDING_APPROVAL').length;
      if (pr) items.push({ id: 'reports', icon: FileText, text: `${plural(pr, 'report')} waiting for your approval`, to: EXECUTIVE_ROUTES.REPORTS, count: pr });
      const pa = (amendments.data ?? []).filter((a) => a.status === 'PENDING_APPROVAL').length;
      if (pa) items.push({ id: 'amendments', icon: FilePenLine, text: `${plural(pa, 'amendment')} waiting for your decision`, to: EXECUTIVE_ROUTES.AMENDMENTS, count: pa });
      const critical = open.filter((a) => a.severity === 'CRITICAL').length;
      if (critical) items.push({ id: 'critical', icon: AlertTriangle, text: `${plural(critical, 'critical alert')} open`, to: EXECUTIVE_ROUTES.HOME, count: critical });
    } else {
      const to = ALERT_ROUTE[role] ?? '/';
      open.slice(0, 5).forEach((a) =>
        items.push({
          id: a.id,
          icon: a.severity === 'CRITICAL' ? AlertTriangle : ClipboardCheck,
          text: a.message,
          detail: [a.severity === 'CRITICAL' ? 'Critical' : 'Warning', a.departmentName].filter(Boolean).join(' · '),
          to,
          count: 1,
        }),
      );
      if (open.length > 5) items.push({ id: 'more', icon: AlertTriangle, text: `+${open.length - 5} more open alerts`, to, count: open.length - 5 });
    }
  }

  const isLoading = isAdmin ? overview.isLoading : alerts.isLoading;
  return { items, count: items.reduce((n, i) => n + i.count, 0), isLoading };
}
