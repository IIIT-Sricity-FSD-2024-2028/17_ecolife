import {
  LayoutDashboard, FilePlus2, History, BellRing, UserCircle, ClipboardCheck, LineChart, Target, FileText,
  FilePenLine, Users, MapPin, CreditCard, ScrollText, FileCheck2,
} from 'lucide-react';
import { ORG_ROLES } from '../constants/roles';

const { ORG_ADMIN, CONTRIBUTOR, REVIEWER, EXECUTIVE } = ORG_ROLES;

// One place mapping "what can this role do" — components call these
// instead of scattering `role === 'X'` checks everywhere. If a permission
// rule changes, it changes here once.
export const permissions = {
  canManageDepartments: (role) => role === ORG_ADMIN,
  canManageOrgUsers: (role) => role === ORG_ADMIN,
  canManageBilling: (role) => role === ORG_ADMIN,
  canCreateResourceRecord: (role) => role === CONTRIBUTOR,
  canEditOwnResourceRecord: (role) => role === CONTRIBUTOR,
  canReviewSubmission: (role) => role === REVIEWER,
  canSetTargets: (role) => role === REVIEWER,
  canProposeAmendment: (role) => role === REVIEWER,
  canGenerateReport: (role) => role === REVIEWER,
  canApproveAmendment: (role) => role === EXECUTIVE,
  canApproveReport: (role) => role === EXECUTIVE,
  canRespondToAlert: (role) => role === CONTRIBUTOR || role === ORG_ADMIN,
};

// Nav items per role — the Sidebar reads this instead of branching with
// if/else for every role, the exact repeated-UI problem identified for
// the old application's navigation.
export function getNavItemsForRole(role) {
  if (role === CONTRIBUTOR) {
    return [
      { label: 'Dashboard', path: '/contributor', icon: LayoutDashboard },
      { label: 'Data Submission', path: '/contributor/submit', icon: FilePlus2 },
      { label: 'Submission History', path: '/contributor/history', icon: History },
      { label: 'Alerts', path: '/contributor/alerts', icon: BellRing },
      { label: 'Profile', path: '/contributor/profile', icon: UserCircle },
    ];
  }
  if (role === REVIEWER) {
    return [
      { label: 'Dashboard', path: '/reviewer', icon: LayoutDashboard },
      { label: 'Submissions', path: '/reviewer/submissions', icon: ClipboardCheck },
      { label: 'Emissions Analysis', path: '/reviewer/emissions', icon: LineChart },
      { label: 'Targets', path: '/reviewer/targets', icon: Target },
      { label: 'Reports', path: '/reviewer/reports', icon: FileText },
      { label: 'Amendments', path: '/reviewer/amendments', icon: FilePenLine },
      { label: 'Alerts', path: '/reviewer/alerts', icon: BellRing },
      { label: 'Profile', path: '/reviewer/profile', icon: UserCircle },
    ];
  }

  if (role === ORG_ADMIN) {
    return [
      { label: 'Dashboard', path: '/org-admin', icon: LayoutDashboard },
      { label: 'Departments & Staff', path: '/org-admin/people', icon: Users },
      { label: 'Locations', path: '/org-admin/locations', icon: MapPin },
      { label: 'Alerts', path: '/org-admin/alerts', icon: BellRing },
      { label: 'Billing', path: '/org-admin/billing', icon: CreditCard },
      { label: 'Audit Log', path: '/org-admin/audit-log', icon: ScrollText },
      { label: 'Profile', path: '/org-admin/profile', icon: UserCircle },
    ];
  }
  if (role === EXECUTIVE) {
    return [
      { label: 'Dashboard', path: '/executive', icon: LayoutDashboard },
      { label: 'Report Approval', path: '/executive/reports', icon: FileCheck2 },
      { label: 'Amendment Approval', path: '/executive/amendments', icon: FilePenLine },
      { label: 'Profile', path: '/executive/profile', icon: UserCircle },
    ];
  }
  return [{ label: 'Dashboard', path: '/', icon: LayoutDashboard }];
}

/** Where each role lands after signing in. */
export function getHomePathForRole(role) {
  if (role === CONTRIBUTOR) return '/contributor';
  if (role === REVIEWER) return '/reviewer';
  if (role === ORG_ADMIN) return '/org-admin';
  if (role === EXECUTIVE) return '/executive';
  return '/';
}

/** Each role's own Profile page — the topbar profile menu links here. */
export function getProfilePathForRole(role) {
  if (role === CONTRIBUTOR) return '/contributor/profile';
  if (role === REVIEWER) return '/reviewer/profile';
  if (role === ORG_ADMIN) return '/org-admin/profile';
  if (role === EXECUTIVE) return '/executive/profile';
  return '/';
}
