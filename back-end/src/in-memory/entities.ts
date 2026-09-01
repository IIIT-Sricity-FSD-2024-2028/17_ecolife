export type RoleName = 'Super User' | 'COO' | 'Manager' | 'Analyst';

export interface User {
  id: number;
  name: string;
  role: RoleName;
  email: string;
  password: string;
  department: string;
  departmentId: string;
  assignedDepartmentIds: string[];
  organizationId: string;
  phone: string;
  status: 'Active' | 'Inactive' | 'Pending';
  lastLogin: string;
}

export interface Organization {
  id: string;
  name: string;
  industry: string;
  cooName: string;
  cooUserId: number | null;
  cooEmail: string;
  departmentIds: string[];
  target: string;
  threshold: string;
  current: string;
  co2: string;
  status: string;
  statusType: string;
  accountStatus?: string;
  registrationStatus: string;
  registrationStatusType: string;
}

export interface Department {
  id: string;
  orgId: string;
  orgName?: string;
  name: string;
  manager: string;
  managerUserId: number | null;
  target: string;
  threshold: string;
  current: string;
  co2: string;
  status: string;
  statusType: string;
  resourceTargets?: ResourceTarget[];
}

export interface ResourceLine {
  type: string;
  unit: string;
  qty: number;
  resourceTypeId?: string;
  unitId?: string;
  evidenceId?: string;
}

export interface ResourceTarget {
  id?: string;
  name: string;
  unit: string;
  target: number;
  threshold: number;
}

export interface Submission {
  id: string;
  organizationId: string;
  departmentId: string;
  departmentName: string;
  managerName: string;
  managerUserId: number | null;
  period: string;
  status: string;
  score: string;
  submittedAt: string;
  resources: ResourceLine[];
  totalConsumption: number;
  totalCO2: number;
  validation: { state: string; anomalyScore: number; deviationReason: string };
  locked: boolean;
  dataReadinessStatus?: 'Draft' | 'Ready' | 'Needs Correction';
  calculationStatus?: 'Pending' | 'Calculated' | 'Error';
  resourceRecordIds?: string[];
  impactResultIds?: string[];
  correctionNotes?: string;
  analystNotes?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ResourceCategory {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  dimension: string;
  active: boolean;
}

export interface ResourceType {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  defaultUnitId: string;
  active: boolean;
}

export interface ResourceUnitCompatibility {
  id: string;
  resourceTypeId: string;
  unitId: string;
  active: boolean;
}

export interface EmissionFactorSource {
  id: string;
  name: string;
  publisher: string;
  region: string;
  datasetName?: string;
  datasetUrl?: string;
  acquisitionMethod?: 'Manual Upload' | 'Published Dataset' | 'API' | 'Other';
  license?: string;
  notes?: string;
  active: boolean;
}

export interface FactorVersion {
  id: string;
  sourceId: string;
  name: string;
  datasetName?: string;
  datasetYear?: string;
  importedAt?: string;
  importedBy?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'Draft' | 'Active' | 'Archived' | 'Retired';
  locked: boolean;
}

export interface EmissionFactor {
  id: string;
  sourceId: string;
  versionId: string;
  resourceTypeId: string;
  unitId: string;
  factor: number;
  factorUnit: string;
  geography: string;
  scope?: string;
  activityBoundary?: string;
  uncertainty?: string;
  notes?: string;
  validFrom: string;
  validTo?: string;
  active: boolean;
}

export interface Evidence {
  id: string;
  submissionId?: string;
  resourceRecordId?: string;
  fileName: string;
  fileType: string;
  fileSizeBytes?: number;
  status: 'Uploaded' | 'Unsupported' | 'Extraction Failed' | 'Extracted';
  extractedFields: Record<string, string | number>;
  notes?: string;
  createdAt: string;
}

export interface ImportBatch {
  id: string;
  organizationId: string;
  departmentId: string;
  fileName: string;
  status: 'Pending' | 'Processed' | 'Failed';
  createdAt: string;
  rowCount: number;
  createdRecordIds: string[];
}

export interface ImportError {
  id: string;
  batchId: string;
  rowNumber: number;
  field: string;
  message: string;
}

export interface ResourceRecord {
  id: string;
  submissionId?: string;
  organizationId: string;
  departmentId: string;
  resourceTypeId: string;
  unitId: string;
  quantity: number;
  activityDate: string;
  period: string;
  entryMode: 'Manual' | 'Import' | 'Evidence';
  evidenceId?: string;
  status: 'Draft' | 'Ready' | 'Rejected';
  validationErrors: string[];
  createdAt: string;
}

export interface ImpactCalculation {
  id: string;
  resourceRecordId: string;
  status: 'Calculated' | 'Error';
  message: string;
  calculatedAt: string;
}

export interface ImpactResult {
  id: string;
  calculationId: string;
  resourceRecordId: string;
  submissionId?: string;
  organizationId: string;
  departmentId: string;
  period: string;
  resourceTypeId: string;
  unitId: string;
  quantity: number;
  factorId: string;
  factorVersionId: string;
  factorSourceId: string;
  factor: number;
  co2e: number;
  calculatedAt: string;
}

export interface Report {
  id: number | string;
  title: string;
  period: string;
  date: string;
  status: string;
  statusClass: string;
  organizationId?: string;
  analystName: string;
  analystUserId: number | null;
  submittedBy?: string;
  submittedAt?: string;
  reviewedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  decisionDate?: string;
  sourceSubmissionIds?: string[];
  signature: { signedBy: string; signedAt: string };
  revision: { required: boolean; comment: string; requestedBy: string; requestedAt: string };
  content: Record<string, string>;
}

export interface Alert {
  id: string;
  type: string;
  severity: string;
  roleScope: RoleName[];
  organizationId: string;
  departmentId: string;
  departmentName: string;
  status: string;
  message: string;
  deviationReason: string;
  response?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: number;
  role: RoleName;
  organizationId?: string;
  departmentId?: string;
  userId?: number | null;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  details: string;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  status: string;
  statusType: string;
  ip?: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
  annualDiscount?: number; // e.g. 17 for ~17% off
  currency: string;
  maxUsers: number;
  maxAdditionalUsers?: number; // Configurable max expansion users ceiling
  additionalUserPriceMonthly?: number; // Configurable expansion price per extra user/month
  additionalUserPriceAnnual?: number;
  maxDepartments: number;
  maxAdditionalDepartments?: number; // Configurable max expansion departments ceiling
  additionalDepartmentPriceMonthly?: number; // Configurable expansion price per extra department/month
  additionalDepartmentPriceAnnual?: number;
  maxSubmissions?: number; // submissions per month limit
  maxReports: number;
  maxStorage: number; // in GB
  features: string[];
  supportLevel?: string; // 'Standard' | 'Priority 24/7' | 'Dedicated Key Account Manager'
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export interface Addon {
  id: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceAnnual: number;
  additionalStorageGb?: number; // e.g. 50 GB
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  billingCycle: 'MONTHLY' | 'ANNUAL';
  customPrice?: number; // Negotiated Enterprise price per billing cycle
  addonIds?: string[]; // Selected optional add-on IDs
  extraUsers?: number; // Pre-purchased extra user seats
  extraDepartments?: number; // Pre-purchased extra departments
  startDate: string;
  renewalDate: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GlobalSettings {

  lockout: string;
  session: string;
  otpExp: string;
  maxUsers: string;
  flagMain: boolean;
  flagEmail: boolean;
  flag2fa: boolean;
}

export interface RorizonDb {

  version: number;
  users: User[];
  organizations: Organization[];
  departments: Department[];
  submissions: Submission[];
  resourceCategories: ResourceCategory[];
  units: Unit[];
  resourceTypes: ResourceType[];
  resourceUnitCompatibilities: ResourceUnitCompatibility[];
  factorSources: EmissionFactorSource[];
  factorVersions: FactorVersion[];
  emissionFactors: EmissionFactor[];
  evidences: Evidence[];
  importBatches: ImportBatch[];
  importErrors: ImportError[];
  resourceRecords: ResourceRecord[];
  impactCalculations: ImpactCalculation[];
  impactResults: ImpactResult[];
  managerSubmissions: any[];
  submissionTracker: any[];
  reports: Report[];
  alerts: Alert[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  plans: Plan[];
  addons?: Addon[];
  subscriptions: Subscription[];
  systemMetrics: Record<string, string>;
  modules: any[];
  cooKpis: Record<string, string | number>;
  chartData: { months: string[]; emissions: number[] };
  managerChartData: { months: string[]; myDeptUsage: number[]; orgAvgUsage: number[] };
  managerDailyUsage: Record<string, number[]>;
  globalSettings: GlobalSettings;
}

