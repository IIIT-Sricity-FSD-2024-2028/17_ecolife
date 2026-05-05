export declare class ResourceDto {
    type: string;
    unit: string;
    qty: number;
    emissionFactor?: number;
    co2?: number;
}
export declare class UserDto {
    id?: number;
    name: string;
    role: any;
    email: string;
    password: string;
    department?: string;
    departmentId?: string;
    assignedDepartmentIds?: string[];
    organizationId?: string;
    phone?: string;
    status?: any;
    lastLogin?: string;
}
declare const UpdateUserDto_base: import("@nestjs/common").Type<Partial<UserDto>>;
export declare class UpdateUserDto extends UpdateUserDto_base {
}
export declare class OrganizationDto {
    id?: string;
    name: string;
    industry: string;
    cooName?: string;
    cooUserId?: number;
    cooEmail?: string;
    target?: string;
    threshold?: string;
    departmentIds?: string[];
    current?: string;
    co2?: string;
    status?: string;
    statusType?: string;
    registrationStatus?: string;
    registrationStatusType?: string;
}
declare const UpdateOrganizationDto_base: import("@nestjs/common").Type<Partial<OrganizationDto>>;
export declare class UpdateOrganizationDto extends UpdateOrganizationDto_base {
}
export declare class DepartmentDto {
    id?: string;
    orgId: string;
    name: string;
    manager?: string;
    managerUserId?: number;
    target?: string;
    threshold?: string;
    orgName?: string;
    current?: string;
    co2?: string;
    status?: string;
    statusType?: string;
    resourceTargets?: Record<string, any>[];
}
declare const UpdateDepartmentDto_base: import("@nestjs/common").Type<Partial<DepartmentDto>>;
export declare class UpdateDepartmentDto extends UpdateDepartmentDto_base {
}
export declare class SubmissionDto {
    id?: string;
    organizationId: string;
    departmentId: string;
    period: string;
    resources: ResourceDto[];
    managerName?: string;
    managerUserId?: number;
    validation?: any;
    departmentName?: string;
    status?: string;
    score?: string;
    submittedAt?: string;
    resubmittedAt?: string;
    totalConsumption?: number;
    totalCO2?: number;
    locked?: boolean;
}
declare const UpdateSubmissionDto_base: import("@nestjs/common").Type<Partial<SubmissionDto>>;
export declare class UpdateSubmissionDto extends UpdateSubmissionDto_base {
}
export declare class ReportDto {
    id?: number;
    title: string;
    period: string;
    organizationId?: string;
    status?: string;
    analystName?: string;
    content?: Record<string, string>;
    date?: string;
    statusClass?: string;
    analystUserId?: number;
    sourceSubmissionIds?: string[];
    signature?: Record<string, any>;
    revision?: Record<string, any>;
    version?: number;
    versions?: any[];
    reviewedBy?: string;
    reviewedByUserId?: number;
    decisionDate?: string;
    resubmittedAt?: string;
}
declare const UpdateReportDto_base: import("@nestjs/common").Type<Partial<ReportDto>>;
export declare class UpdateReportDto extends UpdateReportDto_base {
}
export declare class AlertDto {
    id?: string;
    type: string;
    severity: string;
    organizationId: string;
    departmentId: string;
    departmentName: string;
    status: string;
    message: string;
    roleScope?: string[];
    deviationReason?: string;
    response?: string;
    createdAt?: string;
    updatedAt?: string;
}
declare const UpdateAlertDto_base: import("@nestjs/common").Type<Partial<AlertDto>>;
export declare class UpdateAlertDto extends UpdateAlertDto_base {
}
export declare class NotificationDto {
    id?: number;
    role: any;
    title: string;
    body?: string;
    read?: boolean;
    details?: string;
    userId?: number;
    message?: string;
    type?: string;
    timestamp?: string;
    createdAt?: string;
}
declare const UpdateNotificationDto_base: import("@nestjs/common").Type<Partial<NotificationDto>>;
export declare class UpdateNotificationDto extends UpdateNotificationDto_base {
}
export declare class LoginDto {
    email: string;
    password: string;
}
export declare class RevisionDto {
    comment: string;
    requestedBy?: string;
}
export declare class ApproveReportDto {
    approvedBy?: string;
}
export declare class AlertResponseDto {
    response: string;
}
export declare class AuditLogDto {
    id?: number;
    timestamp: string;
    actor: string;
    action: string;
    status: string;
    statusType: string;
    ip?: string;
}
declare const UpdateAuditLogDto_base: import("@nestjs/common").Type<Partial<AuditLogDto>>;
export declare class UpdateAuditLogDto extends UpdateAuditLogDto_base {
}
export declare class SnapshotDto {
    version?: number;
    users?: Record<string, any>[];
    organizations?: Record<string, any>[];
    departments?: Record<string, any>[];
    submissions?: Record<string, any>[];
    managerSubmissions?: Record<string, any>[];
    submissionTracker?: Record<string, any>[];
    reports?: Record<string, any>[];
    alerts?: Record<string, any>[];
    notifications?: Record<string, any>[];
    auditLogs?: Record<string, any>[];
    systemMetrics?: Record<string, any>;
    modules?: Record<string, any>[];
    cooKpis?: Record<string, any>;
    chartData?: Record<string, any>;
    managerChartData?: Record<string, any>;
    managerDailyUsage?: Record<string, any>;
    globalSettings?: Record<string, any>;
}
export {};
