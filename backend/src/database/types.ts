// ============================================================================
// TROPOS — in-memory data model.
// Every "table" is a plain array of these shapes. This file is the single
// source of truth for what an entity looks like, the same role a Prisma/
// Kysely schema would play in a real-database version.
// ============================================================================

export type PlatformRole = 'SUPER_ADMIN' | 'PLATFORM_ADMIN';
export type OrgRole = 'ORG_ADMIN' | 'CONTRIBUTOR' | 'REVIEWER' | 'EXECUTIVE';
export type OrgStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'DELETED';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';

export type SubmissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'
  | 'WITHDRAWN'
  | 'LOCKED';

export type ReportStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'REVISION_REQUESTED'
  | 'APPROVED'
  | 'SUPERSEDED';

export type AmendmentStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type ResourceCategory = 'FUEL' | 'ELECTRICITY' | 'WATER' | 'WASTE' | 'TRAVEL' | 'OTHER';
export type EvidenceRequirement = 'NOT_REQUIRED' | 'REQUIRED';

// ---- Platform level ---------------------------------------------------------

export interface PlatformAdmin {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | null;
  jobTitle?: string | null;
  passwordChangedAt?: string | null;
  failedLoginCount?: number;
  lockedUntil?: string | null;
  role: PlatformRole;
  isActive: boolean;
  invitedById: string | null;
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
  deletedAt?: string | null;
}

export interface PlatformSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  defaultSessionTimeoutMin: number;
  /** Failed sign-ins in a row before the account is locked. */
  maxFailedLogins?: number;
  /** How long a locked account stays locked. */
  lockoutMinutes?: number;
  /** When false, new organizations cannot register themselves. */
  allowRegistration?: boolean;
  /** When true, sign-up requires a work email (no personal/disposable addresses). */
  requireWorkEmail?: boolean;
  updatedAt: string;
}

/**
 * Settings written before a field existed (an older data.json) lack the newer
 * keys, so every reader goes through this to get a complete object.
 */
export function resolveSettings(s: PlatformSettings): Required<PlatformSettings> {
  const envWorkEmail = String(process.env.ENFORCE_WORK_EMAIL ?? 'true').toLowerCase() !== 'false';
  return {
    ...s,
    maxFailedLogins: s.maxFailedLogins ?? 5,
    lockoutMinutes: s.lockoutMinutes ?? 15,
    allowRegistration: s.allowRegistration ?? true,
    requireWorkEmail: s.requireWorkEmail ?? envWorkEmail,
  };
}

// ---- Organization level -----------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  maintenanceMode: boolean;
  sessionTimeoutOverrideMin: number | null;
  carbonPricePerTon: number;
  currency: string;
  baselineYear: number | null;
  /** Why the organization was suspended (set when status becomes SUSPENDED). */
  statusReason?: string | null;
  statusChangedAt?: string | null;
  /** When marked for deletion (soft-deleted). */
  deletedAt?: string | null;
  /** Automatically permanently purged after this timestamp (e.g. 30 days after deletion). */
  scheduledPurgeAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  allowedResourceTypeIds?: string[];
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  departmentId: string;
  name: string;
  address: string | null;
  createdAt: string;
}

export interface OrgUser {
  id: string;
  organizationId: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | null;
  jobTitle?: string | null;
  passwordChangedAt?: string | null;
  /** null = signed up but not yet verified; undefined = grandfathered/seeded/invited (treated as verified). */
  emailVerifiedAt?: string | null;
  failedLoginCount?: number;
  lockedUntil?: string | null;
  role: OrgRole;
  isOwner: boolean;
  isActive: boolean;
  departmentId: string | null;
  invitedById: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
}

// ---- Billing ------------------------------------------------------------

export interface Plan {
  id: string;
  name: string;
  maxDepartments: number;
  maxUsers: number;
  maxResourceTypes: number;
  reportFrequency: string;
  priceMonthly: number;
  priceAnnual: number;
  /** Short "who is this for" line shown on the plan card. */
  description?: string | null;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  cycle: BillingCycle;
  startDate: string;
  renewalDate: string | null;
  cancelledAt: string | null;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  organizationId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: string;
  issuedAt: string;
  periodStart: string;
  periodEnd: string;
  /** Line item, e.g. "Growth plan, monthly subscription". */
  description?: string | null;
}

// ---- Resources & units ----------------------------------------------------

export interface ResourceUnit {
  unit: string;
  isDefault: boolean;
}

export interface ResourceType {
  id: string;
  name: string;
  category: ResourceCategory;
  description: string | null;
  evidenceThreshold: number | null;
  units: ResourceUnit[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- Emission factors -------------------------------------------------------

export interface EmissionFactorSource {
  id: string;
  name: string;
  publisher: string;
  referenceUrl: string | null;
  createdAt: string;
}

export interface EmissionFactorVersion {
  id: string;
  resourceTypeId: string;
  sourceId: string;
  organizationId: string | null; // null = global default
  gas: string;
  factorValue: number;
  gwp: number;
  unit: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isLocked: boolean;
  /** Why this factor was added / where it comes from (required for org overrides). */
  notes?: string | null;
  createdById: string | null;
  createdAt: string;
}

// ---- Resource records & workflow --------------------------------------------

export interface ResourceRecord {
  id: string;
  organizationId: string;
  departmentId: string;
  locationId: string | null;
  resourceTypeId: string;
  quantity: number;
  unit: string;
  cost: number | null;
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  status: SubmissionStatus;
  evidenceRequirement: EvidenceRequirement;
  createdById: string;
  submittedAt: string | null;
  lockedAt: string | null;
  /** Set only by the retained withdrawal workflow; never implies physical deletion. */
  withdrawnAt?: string | null;
  withdrawnById?: string | null;
  withdrawalReason?: string | null;
  /** Stable fingerprint for a CSV-created draft, used to make retrying an import safe. */
  importFingerprint?: string | null;
  /** Scope 2 Market Instrument: RECs, PPAs, Green Tariffs under GHG Protocol Scope 2 Guidance */
  marketInstrument?: 'NONE' | 'REC' | 'PPA' | 'GREEN_TARIFF' | null;
  /** Smart meter, IoT device, or automated ingestion source identifier */
  deviceId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  resourceRecordId: string;
  organizationId: string;
  departmentId: string;
  status: SubmissionStatus;
  reviewedById: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  claimedById?: string | null;
  claimedExpiresAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ---- Calculations -------------------------------------------------------

export interface CalculationResult {
  id: string;
  resourceRecordId: string;
  factorVersionId: string;
  co2eKg: number;
  /** Explicit Scope 2 Location-Based Emissions (GHG Protocol Scope 2 Guidance) */
  co2eLocationKg?: number;
  /** Explicit Scope 2 Market-Based Emissions (GHG Protocol Scope 2 Guidance) */
  co2eMarketKg?: number;
  costOfUsage: number | null;
  savingsVsBaseline: number | null;
  carbonExposure: number | null;
  calculatedAt: string;
  recalculatedCount: number;
  /** Set when a newer calculation supersedes this result; retained for historical traceability. */
  supersededAt?: string | null;
  /** Immutable explanation of the calculation, retained with historical results. */
  provenance?: {
    formulaVersion: string;
    recordInput: { quantity: number; unit: string; cost: number | null; periodStart: string; periodEnd: string };
    factors: Array<{ id: string; sourceId: string; gas: string; factorValue: number; gwp: number; unit: string }>;
  };
}

// ---- Amendments -------------------------------------------------------------

export interface Amendment {
  id: string;
  resourceRecordId: string;
  status: AmendmentStatus;
  reason: string;
  originalQuantity?: number | null;
  originalCost?: number | null;
  proposedQuantity: number | null;
  proposedCost: number | null;
  materialityPercent: number | null;
  triggersBaselineRecalc: boolean;
  proposedById: string;
  approvedById: string | null;
  approvalComment: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// ---- Targets -------------------------------------------------------------

export interface Target {
  id: string;
  organizationId: string;
  departmentId: string | null;
  resourceCategory: ResourceCategory | null;
  targetValue: number;
  name?: string | null;
  notes?: string | null;
  metric: string; // "usage" | "cost" | "emissions"
  periodStart: string;
  periodEnd: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Reports -------------------------------------------------------------

export interface Report {
  id: string;
  organizationId: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  notes?: string | null;
  contentJson: unknown;
  pdfFilePath: string | null;
  status: ReportStatus;
  version: number;
  createdById: string;
  approvedById: string | null;
  approvalComment: string | null;
  /** Reviewer's note to the Executive, written when the report is submitted for approval. */
  submissionNote?: string | null;
  approvedAt: string | null;
  supersedesId: string | null;
  isScheduled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- Alerts -------------------------------------------------------------

export interface Alert {
  id: string;
  organizationId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  type: string;
  message: string;
  relatedResourceRecordId: string | null;
  relatedDepartmentId: string | null;
  acknowledgedById?: string | null;
  acknowledgedAt?: string | null;
  createdAt: string;
}

export interface AlertResponse {
  id: string;
  alertId: string;
  respondedById: string;
  responseText: string;
  action: string;
  createdAt: string;
}

// ---- Evidence -------------------------------------------------------------

export interface Evidence {
  id: string;
  resourceRecordId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedById: string;
  uploadedAt: string;
  /** Cryptographic SHA-256 hash for ISAE 3410 and ISO 14064-3 tamper-evident verification */
  sha256Hash?: string;
}

// ---- Imports -------------------------------------------------------------

export interface ImportBatch {
  id: string;
  organizationId: string;
  initiatedById: string;
  fileName: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errorsJson: unknown | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

// ---- Audit log -------------------------------------------------------------

export interface AuditLog {
  id: string;
  organizationId: string | null;
  orgUserId: string | null;
  platformAdminId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ---- Auth support -------------------------------------------------------------

export interface PasswordResetToken {
  id: string;
  token: string;
  orgUserId: string | null;
  platformAdminId: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  /** 'otp' = demo-mode 6-digit code (bound to the account); absent/'link' = emailed link token. */
  kind?: 'link' | 'otp';
  /** Wrong guesses so far (otp only); the code is burned after MAX_OTP_ATTEMPTS. */
  attempts?: number;
}

export type CommentEntityType = 'resource_record' | 'report' | 'amendment';

/** A note left on a record, report or amendment, visible to whoever may see that item. Immutable once posted. */
export interface EntityComment {
  id: string;
  organizationId: string;
  entityType: CommentEntityType;
  entityId: string;
  authorId: string;
  authorRole: OrgRole;
  body: string;
  createdAt: string;
}

/** A notice an Org Admin posts to the whole organization, or to one department. */
export interface Announcement {
  id: string;
  organizationId: string;
  createdById: string;
  title: string;
  body: string;
  departmentId: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface EmailVerificationToken {
  id: string;
  /** SHA-256 hash of the emailed token; the raw token is never stored. */
  token: string;
  orgUserId: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

// ---- The whole store -------------------------------------------------------------

export interface DataStore {
  platformAdmins: PlatformAdmin[];
  platformSettings: PlatformSettings;
  organizations: Organization[];
  departments: Department[];
  locations: Location[];
  orgUsers: OrgUser[];
  plans: Plan[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  resourceTypes: ResourceType[];
  emissionFactorSources: EmissionFactorSource[];
  emissionFactorVersions: EmissionFactorVersion[];
  resourceRecords: ResourceRecord[];
  submissions: Submission[];
  calculationResults: CalculationResult[];
  amendments: Amendment[];
  targets: Target[];
  reports: Report[];
  alerts: Alert[];
  alertResponses: AlertResponse[];
  evidence: Evidence[];
  importBatches: ImportBatch[];
  auditLogs: AuditLog[];
  passwordResetTokens: PasswordResetToken[];
  emailVerificationTokens: EmailVerificationToken[];
  comments: EntityComment[];
  announcements: Announcement[];
}

export function createEmptyStore(): DataStore {
  return {
    platformAdmins: [],
    platformSettings: {
      maintenanceMode: false,
      maintenanceMessage: null,
      defaultSessionTimeoutMin: 720,
      updatedAt: new Date().toISOString(),
    },
    organizations: [],
    departments: [],
    locations: [],
    orgUsers: [],
    plans: [],
    subscriptions: [],
    invoices: [],
    resourceTypes: [],
    emissionFactorSources: [],
    emissionFactorVersions: [],
    resourceRecords: [],
    submissions: [],
    calculationResults: [],
    amendments: [],
    targets: [],
    reports: [],
    alerts: [],
    alertResponses: [],
    evidence: [],
    importBatches: [],
    auditLogs: [],
    passwordResetTokens: [],
    emailVerificationTokens: [],
    comments: [],
    announcements: [],
  };
}
