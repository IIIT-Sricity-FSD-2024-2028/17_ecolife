// Central place for every route path — pages and nav links both import
// from here, so a path never needs to be typed as a raw string twice.

export const ORG_ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
  DASHBOARD: '/',
  RESOURCE_RECORDS: '/resource-records',
  RESOURCE_RECORD_NEW: '/resource-records/new',
  RESOURCE_RECORD_DETAIL: '/resource-records/:id',
  REPORTS: '/reports',
  REPORT_DETAIL: '/reports/:id',
  DEPARTMENTS: '/departments',
  ORG_USERS: '/org-users',
  ALERTS: '/alerts',
  BILLING: '/billing',
  TARGETS: '/targets',
};

export const CONTRIBUTOR_ROUTES = {
  HOME: '/contributor',
  SUBMIT: '/contributor/submit',
  HISTORY: '/contributor/history',
  ALERTS: '/contributor/alerts',
  PROFILE: '/contributor/profile',
};

export const REVIEWER_ROUTES = {
  HOME: '/reviewer',
  SUBMISSIONS: '/reviewer/submissions',
  EMISSIONS: '/reviewer/emissions',
  TARGETS: '/reviewer/targets',
  REPORTS: '/reviewer/reports',
  AMENDMENTS: '/reviewer/amendments',
  ALERTS: '/reviewer/alerts',
  PROFILE: '/reviewer/profile',
};

export const ORG_ADMIN_ROUTES = {
  HOME: '/org-admin',
  PEOPLE: '/org-admin/people',
  LOCATIONS: '/org-admin/locations',
  ALERTS: '/org-admin/alerts',
  BILLING: '/org-admin/billing',
  AUDIT_LOG: '/org-admin/audit-log',
  PROFILE: '/org-admin/profile',
};

export const EXECUTIVE_ROUTES = {
  HOME: '/executive',
  REPORTS: '/executive/reports',
  AMENDMENTS: '/executive/amendments',
  PROFILE: '/executive/profile',
};

export const ADMIN_ROUTES = {
  LOGIN: '/admin/login',
  FORGOT_PASSWORD: '/admin/forgot-password',
  RESET_PASSWORD: '/admin/reset-password',
  DASHBOARD: '/admin',
  ORGANIZATIONS: '/admin/organizations',
  RESOURCES: '/admin/resources',
  REVENUE: '/admin/revenue',
  AUDIT_LOG: '/admin/audit-log',
  PROFILE: '/admin/profile',
  ADMIN_TEAM: '/admin/admin-team',
  SETTINGS: '/admin/settings',
};

