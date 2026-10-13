// Mirrors the backend's role enums exactly (src/database/types.ts).

export const ORG_ROLES = {
  ORG_ADMIN: 'ORG_ADMIN',
  CONTRIBUTOR: 'CONTRIBUTOR',
  REVIEWER: 'REVIEWER',
  EXECUTIVE: 'EXECUTIVE',
};

export const PLATFORM_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
};

// Human-readable labels for display — the only place role names are
// "translated" for the UI, so relabeling later touches one file.
export const ORG_ROLE_LABELS = {
  ORG_ADMIN: 'Org Admin',
  CONTRIBUTOR: 'Contributor',
  REVIEWER: 'Reviewer',
  EXECUTIVE: 'Executive',
};

export const PLATFORM_ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  PLATFORM_ADMIN: 'Platform Admin',
};

export const SUBMISSION_STATUS_LABELS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CHANGES_REQUESTED: 'Changes Requested',
  LOCKED: 'Locked',
};

export const REPORT_STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  REVISION_REQUESTED: 'Revision Requested',
  APPROVED: 'Approved',
  SUPERSEDED: 'Superseded',
};
