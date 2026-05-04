import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class ResourceDto {
  @ApiProperty({ example: 'Diesel' }) @IsString() @IsNotEmpty() type: string;
  @ApiProperty({ example: 'Liters' }) @IsString() @IsNotEmpty() unit: string;
  @ApiProperty({ example: 2500 }) @IsNumber() @Min(0.01) qty: number;
}

export class UserDto {
  @ApiPropertyOptional({ example: 105 }) @IsOptional() @IsNumber() id?: number;
  @ApiProperty({ example: 'New Manager' }) @IsString() @IsNotEmpty() name: string;
  @ApiProperty({ example: 'Manager', enum: ['Super User', 'COO', 'Manager', 'Analyst'] }) @IsIn(['Super User', 'COO', 'Manager', 'Analyst']) role: any;
  @ApiProperty({ example: 'asha@tc.com' }) @IsEmail() email: string;
  @ApiProperty({ example: 'Default@123' }) @IsString() @IsNotEmpty() password: string;
  @ApiPropertyOptional({ example: 'Operations' }) @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional({ example: 'dept-ops' }) @IsOptional() @IsString() departmentId?: string;
  @ApiPropertyOptional({ example: ['dept-ops'] }) @IsOptional() @IsArray() assignedDepartmentIds?: string[];
  @ApiPropertyOptional({ example: 'org-tc' }) @IsOptional() @IsString() organizationId?: string;
  @ApiPropertyOptional({ example: '5550198236' }) @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional({ example: 'Active', enum: ['Active', 'Inactive', 'Pending'] }) @IsOptional() @IsIn(['Active', 'Inactive', 'Pending']) status?: any;
  @ApiPropertyOptional({ example: 'Apr 01, 2026, 09:00 AM' }) @IsOptional() @IsString() lastLogin?: string;
}

export class UpdateUserDto extends PartialType(UserDto) {}

export class OrganizationDto {
  @ApiPropertyOptional({ example: 'org-acme' }) @IsOptional() @IsString() id?: string;
  @ApiProperty({ example: 'Acme Industries' }) @IsString() @IsNotEmpty() name: string;
  @ApiProperty({ example: 'Manufacturing' }) @IsString() @IsNotEmpty() industry: string;
  @ApiPropertyOptional({ example: 'COO Name' }) @IsOptional() @IsString() cooName?: string;
  @ApiPropertyOptional({ example: 102 }) @IsOptional() @IsNumber() cooUserId?: number;
  @ApiPropertyOptional({ example: 'coo@acme.com' }) @IsOptional() @IsEmail() cooEmail?: string;
  @ApiPropertyOptional({ example: '10,000 L' }) @IsOptional() @IsString() target?: string;
  @ApiPropertyOptional({ example: '11,000 L' }) @IsOptional() @IsString() threshold?: string;
  @ApiPropertyOptional({ example: ['dept-ops'] }) @IsOptional() @IsArray() departmentIds?: string[];
  @ApiPropertyOptional({ example: '9,500 L' }) @IsOptional() @IsString() current?: string;
  @ApiPropertyOptional({ example: '25,000' }) @IsOptional() @IsString() co2?: string;
  @ApiPropertyOptional({ example: 'Within Target' }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: 'green' }) @IsOptional() @IsString() statusType?: string;
  @ApiPropertyOptional({ example: 'Approved' }) @IsOptional() @IsString() registrationStatus?: string;
  @ApiPropertyOptional({ example: 'green' }) @IsOptional() @IsString() registrationStatusType?: string;
}

export class UpdateOrganizationDto extends PartialType(OrganizationDto) {}

export class DepartmentDto {
  @ApiPropertyOptional({ example: 'dept-energy' }) @IsOptional() @IsString() id?: string;
  @ApiProperty({ example: 'org-tc' }) @IsString() @IsNotEmpty() orgId: string;
  @ApiProperty({ example: 'Energy' }) @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional({ example: 'Unassigned' }) @IsOptional() @IsString() manager?: string;
  @ApiPropertyOptional({ example: 103 }) @IsOptional() @IsNumber() managerUserId?: number;
  @ApiPropertyOptional({ example: '5,000 L' }) @IsOptional() @IsString() target?: string;
  @ApiPropertyOptional({ example: '5,500 L' }) @IsOptional() @IsString() threshold?: string;
  @ApiPropertyOptional({ example: 'TC Works' }) @IsOptional() @IsString() orgName?: string;
  @ApiPropertyOptional({ example: '4,800 L' }) @IsOptional() @IsString() current?: string;
  @ApiPropertyOptional({ example: '12,500' }) @IsOptional() @IsString() co2?: string;
  @ApiPropertyOptional({ example: 'Within Target' }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: 'green' }) @IsOptional() @IsString() statusType?: string;
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() resourceTargets?: Record<string, any>[];
}

export class UpdateDepartmentDto extends PartialType(DepartmentDto) {}

export class SubmissionDto {
  @ApiPropertyOptional({ example: 'sub-001' }) @IsOptional() @IsString() id?: string;
  @ApiProperty({ example: 'org-tc' }) @IsString() @IsNotEmpty() organizationId: string;
  @ApiProperty({ example: 'dept-ops' }) @IsString() @IsNotEmpty() departmentId: string;
  @ApiProperty({ example: '03 2026' }) @IsString() @IsNotEmpty() period: string;
  @ApiProperty({ type: [ResourceDto] }) @IsArray() resources: ResourceDto[];
  @ApiPropertyOptional({ example: 'Asha' }) @IsOptional() @IsString() managerName?: string;
  @ApiPropertyOptional({ example: 103 }) @IsOptional() @IsNumber() managerUserId?: number;
  @ApiPropertyOptional({ example: { state: 'valid', anomalyScore: 0, deviationReason: '' } }) @IsOptional() @IsObject() validation?: any;
  @ApiPropertyOptional({ example: 'Operations' }) @IsOptional() @IsString() departmentName?: string;
  @ApiPropertyOptional({ example: 'Pending' }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: 'Evaluating' }) @IsOptional() @IsString() score?: string;
  @ApiPropertyOptional({ example: 'Apr 01, 2026' }) @IsOptional() @IsString() submittedAt?: string;
  @ApiPropertyOptional({ example: 4800 }) @IsOptional() @IsNumber() totalConsumption?: number;
  @ApiPropertyOptional({ example: 12000 }) @IsOptional() @IsNumber() totalCO2?: number;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() locked?: boolean;
}

export class UpdateSubmissionDto extends PartialType(SubmissionDto) {}

export class ReportDto {
  @ApiPropertyOptional({ example: 9003 }) @IsOptional() @IsNumber() id?: number;
  @ApiProperty({ example: 'Emissions Report - March 2026' }) @IsString() @IsNotEmpty() title: string;
  @ApiProperty({ example: 'March 2026' }) @IsString() @IsNotEmpty() period: string;
  @ApiPropertyOptional({ example: 'org-tc' }) @IsOptional() @IsString() organizationId?: string;
  @ApiPropertyOptional({ example: 'Pending Review' }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: 'Meera' }) @IsOptional() @IsString() analystName?: string;
  @ApiPropertyOptional({ example: { intro: 'Overview', analysis: 'Findings' } }) @IsOptional() @IsObject() content?: Record<string, string>;
  @ApiPropertyOptional({ example: '3/5/2026' }) @IsOptional() @IsString() date?: string;
  @ApiPropertyOptional({ example: 'amber' }) @IsOptional() @IsString() statusClass?: string;
  @ApiPropertyOptional({ example: 104 }) @IsOptional() @IsNumber() analystUserId?: number;
  @ApiPropertyOptional({ example: ['sub01', 'sub02'] }) @IsOptional() @IsArray() sourceSubmissionIds?: string[];
  @ApiPropertyOptional({ example: { signedBy: 'Analyst', signedAt: '2026-03-05T00:00:00.000Z' } }) @IsOptional() @IsObject() signature?: Record<string, any>;
  @ApiPropertyOptional({ example: { required: false, comment: '', requestedBy: '', requestedAt: '' } }) @IsOptional() @IsObject() revision?: Record<string, any>;
}

export class UpdateReportDto extends PartialType(ReportDto) {}

export class AlertDto {
  @ApiPropertyOptional({ example: 'alt-003' }) @IsOptional() @IsString() id?: string;
  @ApiProperty({ example: 'Threshold Breach' }) @IsString() @IsNotEmpty() type: string;
  @ApiProperty({ example: 'Critical' }) @IsString() @IsNotEmpty() severity: string;
  @ApiProperty({ example: 'org-tc' }) @IsString() @IsNotEmpty() organizationId: string;
  @ApiProperty({ example: 'dept-mfg' }) @IsString() @IsNotEmpty() departmentId: string;
  @ApiProperty({ example: 'Manufacturing' }) @IsString() @IsNotEmpty() departmentName: string;
  @ApiProperty({ example: 'Open' }) @IsString() @IsNotEmpty() status: string;
  @ApiProperty({ example: 'Consumption exceeded threshold.' }) @IsString() @IsNotEmpty() message: string;
  @ApiPropertyOptional({ example: ['Manager', 'COO'] }) @IsOptional() @IsArray() roleScope?: string[];
  @ApiPropertyOptional({ example: 'Temporary generator usage.' }) @IsOptional() @IsString() deviationReason?: string;
  @ApiPropertyOptional({ example: 'Corrective action completed.' }) @IsOptional() @IsString() response?: string;
  @ApiPropertyOptional({ example: '2026-03-07 14:00:00' }) @IsOptional() @IsString() createdAt?: string;
  @ApiPropertyOptional({ example: '2026-03-07 14:00:00' }) @IsOptional() @IsString() updatedAt?: string;
}

export class UpdateAlertDto extends PartialType(AlertDto) {}

export class NotificationDto {
  @ApiPropertyOptional({ example: 10 }) @IsOptional() @IsNumber() id?: number;
  @ApiProperty({ example: 'Manager', enum: ['Super User', 'COO', 'Manager', 'Analyst'] }) @IsIn(['Super User', 'COO', 'Manager', 'Analyst']) role: any;
  @ApiProperty({ example: 'Target Nearing' }) @IsString() @IsNotEmpty() title: string;
  @ApiPropertyOptional({ example: 'Operations is nearing threshold.' }) @IsOptional() @IsString() body?: string;
  @ApiPropertyOptional({ example: false }) @IsOptional() @IsBoolean() read?: boolean;
  @ApiPropertyOptional({ example: 'Extra details' }) @IsOptional() @IsString() details?: string;
  @ApiPropertyOptional({ example: 103 }) @IsOptional() @IsNumber() userId?: number;
  @ApiPropertyOptional({ example: 'Target Nearing' }) @IsOptional() @IsString() message?: string;
  @ApiPropertyOptional({ example: 'info' }) @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional({ example: 'Just now' }) @IsOptional() @IsString() timestamp?: string;
  @ApiPropertyOptional({ example: '2026-03-07T14:00:00.000Z' }) @IsOptional() @IsString() createdAt?: string;
}

export class UpdateNotificationDto extends PartialType(NotificationDto) {}

export class LoginDto {
  @ApiProperty({ example: 'admin@rorizon.com' }) @IsEmail() email: string;
  @ApiProperty({ example: 'Admin@123' }) @IsString() @IsNotEmpty() password: string;
}

export class RevisionDto {
  @ApiProperty({ example: 'Please include department variance details.' }) @IsString() @IsNotEmpty() comment: string;
  @ApiPropertyOptional({ example: 'Rajesh (COO)' }) @IsOptional() @IsString() requestedBy?: string;
}

export class ApproveReportDto {
  @ApiPropertyOptional({ example: 'Rajesh (COO)' }) @IsOptional() @IsString() approvedBy?: string;
}

export class AlertResponseDto {
  @ApiProperty({ example: 'Corrective action completed.' }) @IsString() @IsNotEmpty() response: string;
}

export class AuditLogDto {
  @ApiPropertyOptional({ example: 1714520000000 }) @IsOptional() @IsNumber() id?: number;
  @ApiProperty({ example: '2026-04-01 09:15:00' }) @IsString() @IsNotEmpty() timestamp: string;
  @ApiProperty({ example: 'System Admin (Super User)' }) @IsString() @IsNotEmpty() actor: string;
  @ApiProperty({ example: 'User Updated' }) @IsString() @IsNotEmpty() action: string;
  @ApiProperty({ example: 'Success' }) @IsString() @IsNotEmpty() status: string;
  @ApiProperty({ example: 'green' }) @IsString() @IsNotEmpty() statusType: string;
  @ApiPropertyOptional({ example: '127.0.0.1' }) @IsOptional() @IsString() ip?: string;
}

export class UpdateAuditLogDto extends PartialType(AuditLogDto) {}

export class SnapshotDto {
  @ApiPropertyOptional({ example: 6 }) @IsOptional() @IsNumber() version?: number;
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() users?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() organizations?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() departments?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() submissions?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() managerSubmissions?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() submissionTracker?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() reports?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() alerts?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() notifications?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() auditLogs?: Record<string, any>[];
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() systemMetrics?: Record<string, any>;
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() modules?: Record<string, any>[];
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() cooKpis?: Record<string, any>;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() chartData?: Record<string, any>;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() managerChartData?: Record<string, any>;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() managerDailyUsage?: Record<string, any>;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() globalSettings?: Record<string, any>;
}
