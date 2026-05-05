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
    targetPlans?: Record<string, {
        period: string;
        resourceTargets: ResourceTarget[];
        target: string;
        threshold: string;
        updatedAt: string;
    }>;
}
export interface ResourceLine {
    type: string;
    unit: string;
    qty: number;
    emissionFactor?: number;
    co2?: number;
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
    resubmittedAt?: string;
    resources: ResourceLine[];
    totalConsumption: number;
    totalCO2: number;
    validation: {
        state: string;
        anomalyScore: number;
        deviationReason: string;
    };
    locked: boolean;
}
export interface Report {
    id: number;
    title: string;
    period: string;
    date: string;
    status: string;
    statusClass: string;
    organizationId?: string;
    analystName: string;
    analystUserId: number | null;
    sourceSubmissionIds?: string[];
    signature: {
        signedBy: string;
        signedAt: string;
    };
    revision: {
        required: boolean;
        comment: string;
        requestedBy: string;
        requestedAt: string;
    };
    content: Record<string, string>;
    version?: number;
    versions?: any[];
    reviewedBy?: string;
    reviewedByUserId?: number;
    decisionDate?: string;
    resubmittedAt?: string;
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
    userId?: number;
    organizationId?: string;
    departmentId?: string;
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
    managerSubmissions: any[];
    submissionTracker: any[];
    reports: Report[];
    alerts: Alert[];
    notifications: NotificationItem[];
    auditLogs: AuditLog[];
    systemMetrics: Record<string, string>;
    modules: any[];
    cooKpis: Record<string, string | number>;
    chartData: {
        months: string[];
        emissions: number[];
    };
    managerChartData: {
        months: string[];
        myDeptUsage: number[];
        orgAvgUsage: number[];
    };
    managerDailyUsage: Record<string, number[]>;
    globalSettings: GlobalSettings;
}
