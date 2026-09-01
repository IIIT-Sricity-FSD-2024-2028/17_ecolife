import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class ResourceDto {
  @ApiProperty({ example: 'Diesel' }) @IsString() @IsNotEmpty() type: string;
  @ApiProperty({ example: 'Liters' }) @IsString() @IsNotEmpty() unit: string;
  @ApiProperty({ example: 2500 }) @IsNumber() @Min(0.01) qty: number;
  @ApiPropertyOptional({ example: 'rt-diesel' }) @IsOptional() @IsString() resourceTypeId?: string;
  @ApiPropertyOptional({ example: 'unit-liter' }) @IsOptional() @IsString() unitId?: string;
  @ApiPropertyOptional({ example: 'ev-001' }) @IsOptional() @IsString() evidenceId?: string;
  @ApiPropertyOptional({ example: 'Manual' }) @IsOptional() @IsString() entryMode?: string;
  @ApiPropertyOptional({ example: 'invoice.pdf' }) @IsOptional() @IsString() evidenceFileName?: string;
  @ApiPropertyOptional({ example: 'Verified invoice' }) @IsOptional() @IsString() evidenceNotes?: string;
}

export class UserDto {
  @ApiPropertyOptional({ example: 105 }) @IsOptional() @IsNumber() id?: number;
  @ApiProperty({ example: 'New Manager' }) @IsString() @IsNotEmpty() name: string;
  @ApiProperty({ example: 'Manager', enum: ['Super User', 'COO', 'Manager', 'Analyst'] }) @IsIn(['Super User', 'COO', 'Manager', 'Analyst']) role: any;
  @ApiProperty({ example: 'manager@techcorp.com' }) @IsEmail() email: string;
  @ApiProperty({ example: 'Default@123' }) @IsString() @IsNotEmpty() password: string;
  @ApiPropertyOptional({ example: 'Operations' }) @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional({ example: 'dept-ops' }) @IsOptional() @IsString() departmentId?: string;
  @ApiPropertyOptional({ example: ['dept-ops'] }) @IsOptional() @IsArray() assignedDepartmentIds?: string[];
  @ApiPropertyOptional({ example: 'org-techcorp' }) @IsOptional() @IsString() organizationId?: string;
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
  @ApiPropertyOptional({ example: 'Active' }) @IsOptional() @IsString() accountStatus?: string;
  @ApiPropertyOptional({ example: 'Approved' }) @IsOptional() @IsString() registrationStatus?: string;
  @ApiPropertyOptional({ example: 'green' }) @IsOptional() @IsString() registrationStatusType?: string;
}

export class UpdateOrganizationDto extends PartialType(OrganizationDto) {}

export class DepartmentDto {
  @ApiPropertyOptional({ example: 'dept-energy' }) @IsOptional() @IsString() id?: string;
  @ApiProperty({ example: 'org-techcorp' }) @IsString() @IsNotEmpty() orgId: string;
  @ApiProperty({ example: 'Energy' }) @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional({ example: 'Unassigned' }) @IsOptional() @IsString() manager?: string;
  @ApiPropertyOptional({ example: 103 }) @IsOptional() @IsNumber() managerUserId?: number;
  @ApiPropertyOptional({ example: '5,000 L' }) @IsOptional() @IsString() target?: string;
  @ApiPropertyOptional({ example: '5,500 L' }) @IsOptional() @IsString() threshold?: string;
  @ApiPropertyOptional({ example: 'TechCorp Industries' }) @IsOptional() @IsString() orgName?: string;
  @ApiPropertyOptional({ example: '4,800 L' }) @IsOptional() @IsString() current?: string;
  @ApiPropertyOptional({ example: '12,500' }) @IsOptional() @IsString() co2?: string;
  @ApiPropertyOptional({ example: 'Within Target' }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: 'green' }) @IsOptional() @IsString() statusType?: string;
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() resourceTargets?: Record<string, any>[];
}

export class UpdateDepartmentDto extends PartialType(DepartmentDto) {}

export class SubmissionDto {
  @ApiPropertyOptional({ example: 'sub-001' }) @IsOptional() @IsString() id?: string;
  @ApiProperty({ example: 'org-techcorp' }) @IsString() @IsNotEmpty() organizationId: string;
  @ApiProperty({ example: 'dept-ops' }) @IsString() @IsNotEmpty() departmentId: string;
  @ApiProperty({ example: '03 2026' }) @IsString() @IsNotEmpty() period: string;
  @ApiPropertyOptional({ type: [ResourceDto] }) @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ResourceDto) resources?: ResourceDto[];
  @ApiPropertyOptional({ example: ['rec-001'] }) @IsOptional() @IsArray() resourceRecordIds?: string[];
  @ApiPropertyOptional({ example: ['ir-rec-001'] }) @IsOptional() @IsArray() impactResultIds?: string[];
  @ApiPropertyOptional({ example: 'Sarah Miller' }) @IsOptional() @IsString() managerName?: string;
  @ApiPropertyOptional({ example: 103 }) @IsOptional() @IsNumber() managerUserId?: number;
  @ApiPropertyOptional({ example: { state: 'valid', anomalyScore: 0, deviationReason: '' } }) @IsOptional() @IsObject() validation?: any;
  @ApiPropertyOptional({ example: 'Operations' }) @IsOptional() @IsString() departmentName?: string;
  @ApiPropertyOptional({ example: 'Pending' }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: 'Evaluating' }) @IsOptional() @IsString() score?: string;
  @ApiPropertyOptional({ example: 'Apr 01, 2026' }) @IsOptional() @IsString() submittedAt?: string;
  @ApiPropertyOptional({ example: 'Ready' }) @IsOptional() @IsString() dataReadinessStatus?: string;
  @ApiPropertyOptional({ example: 'Pending' }) @IsOptional() @IsString() calculationStatus?: string;
  @ApiPropertyOptional({ example: 'Please verify Diesel volume' }) @IsOptional() @IsString() analystNotes?: string;
  @ApiPropertyOptional({ example: 'Updated invoice attached' }) @IsOptional() @IsString() correctionNotes?: string;
  @ApiPropertyOptional({ example: 4800 }) @IsOptional() @IsNumber() totalConsumption?: number;
  @ApiPropertyOptional({ example: 12000 }) @IsOptional() @IsNumber() totalCO2?: number;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() locked?: boolean;
}

export class UpdateSubmissionDto extends PartialType(SubmissionDto) {}

export class ResourceCategoryDto {
  @ApiPropertyOptional({ example: 'cat-fuel' }) @IsOptional() @IsString() id?: string;
  @ApiProperty({ example: 'Fuel' }) @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional({ example: 'Combustion fuels.' }) @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateResourceCategoryDto extends PartialType(ResourceCategoryDto) {}

export class UnitDto {
  @ApiPropertyOptional({ example: 'unit-liter' }) @IsOptional() @IsString() id?: string;
  @ApiProperty({ example: 'L' }) @IsString() @IsNotEmpty() code: string;
  @ApiProperty({ example: 'Liters' }) @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional({ example: 'volume' }) @IsOptional() @IsString() dimension?: string;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateUnitDto extends PartialType(UnitDto) {}

export class ResourceTypeDto {
  @ApiPropertyOptional({ example: 'rt-diesel' }) @IsOptional() @IsString() id?: string;
  @ApiPropertyOptional({ example: 'cat-fuel' }) @IsOptional() @IsString() categoryId?: string;
  @ApiProperty({ example: 'Diesel' }) @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional({ example: 'Diesel fuel.' }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ example: 'unit-liter' }) @IsString() @IsNotEmpty() defaultUnitId: string;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateResourceTypeDto extends PartialType(ResourceTypeDto) {}

export class ResourceUnitCompatibilityDto {
  @ApiPropertyOptional({ example: 'ruc-diesel-liter' }) @IsOptional() @IsString() id?: string;
  @ApiProperty({ example: 'rt-diesel' }) @IsString() @IsNotEmpty() resourceTypeId: string;
  @ApiProperty({ example: 'unit-liter' }) @IsString() @IsNotEmpty() unitId: string;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateResourceUnitCompatibilityDto extends PartialType(ResourceUnitCompatibilityDto) {}

export class FactorSourceDto {
  @ApiPropertyOptional({ example: 'efs-rorizon-demo' }) @IsOptional() @IsString() id?: string;
  @ApiProperty({ example: 'Rorizon Demo Factors' }) @IsString() @IsNotEmpty() name: string;
  @ApiProperty({ example: 'Platform Governance' }) @IsString() @IsNotEmpty() publisher: string;
  @ApiProperty({ example: 'IN' }) @IsString() @IsNotEmpty() region: string;
  @ApiPropertyOptional({ example: 'Published conversion factor dataset' }) @IsOptional() @IsString() datasetName?: string;
  @ApiPropertyOptional({ example: 'https://example.org/dataset' }) @IsOptional() @IsString() datasetUrl?: string;
  @ApiPropertyOptional({ example: 'Published Dataset', enum: ['Manual Upload', 'Published Dataset', 'API', 'Other'] }) @IsOptional() @IsIn(['Manual Upload', 'Published Dataset', 'API', 'Other']) acquisitionMethod?: any;
  @ApiPropertyOptional({ example: 'Open Government License' }) @IsOptional() @IsString() license?: string;
  @ApiPropertyOptional({ example: 'Imported by Super User after dataset review.' }) @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateFactorSourceDto extends PartialType(FactorSourceDto) {}

export class FactorVersionDto {
  @ApiPropertyOptional({ example: 'fv-2026-demo' }) @IsOptional() @IsString() id?: string;
  @ApiProperty({ example: 'efs-rorizon-demo' }) @IsString() @IsNotEmpty() sourceId: string;
  @ApiProperty({ example: '2026 Demo Baseline' }) @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional({ example: 'Government conversion factors' }) @IsOptional() @IsString() datasetName?: string;
  @ApiPropertyOptional({ example: '2026' }) @IsOptional() @IsString() datasetYear?: string;
  @ApiPropertyOptional({ example: '2026-04-01T00:00:00.000Z' }) @IsOptional() @IsString() importedAt?: string;
  @ApiPropertyOptional({ example: 'System Admin' }) @IsOptional() @IsString() importedBy?: string;
  @ApiProperty({ example: '2026-01-01' }) @IsString() @IsNotEmpty() effectiveFrom: string;
  @ApiPropertyOptional({ example: '2026-12-31' }) @IsOptional() @IsString() effectiveTo?: string;
  @ApiPropertyOptional({ example: 'Active', enum: ['Draft', 'Active', 'Archived', 'Retired'] }) @IsOptional() @IsIn(['Draft', 'Active', 'Archived', 'Retired']) status?: any;
  @ApiPropertyOptional({ example: false }) @IsOptional() @IsBoolean() locked?: boolean;
}

export class UpdateFactorVersionDto extends PartialType(FactorVersionDto) {}

export class EmissionFactorDto {
  @ApiPropertyOptional({ example: 'ef-diesel-liter-2026' }) @IsOptional() @IsString() id?: string;
  @ApiProperty({ example: 'efs-rorizon-demo' }) @IsString() @IsNotEmpty() sourceId: string;
  @ApiProperty({ example: 'fv-2026-demo' }) @IsString() @IsNotEmpty() versionId: string;
  @ApiProperty({ example: 'rt-diesel' }) @IsString() @IsNotEmpty() resourceTypeId: string;
  @ApiProperty({ example: 'unit-liter' }) @IsString() @IsNotEmpty() unitId: string;
  @ApiProperty({ example: 2.5 }) @IsNumber() @Min(0) factor: number;
  @ApiProperty({ example: 'kgCO2e/L' }) @IsString() @IsNotEmpty() factorUnit: string;
  @ApiPropertyOptional({ example: 'IN' }) @IsOptional() @IsString() geography?: string;
  @ApiPropertyOptional({ example: 'Scope 1' }) @IsOptional() @IsString() scope?: string;
  @ApiPropertyOptional({ example: 'Combustion, tank-to-wheel' }) @IsOptional() @IsString() activityBoundary?: string;
  @ApiPropertyOptional({ example: 'Medium' }) @IsOptional() @IsString() uncertainty?: string;
  @ApiPropertyOptional({ example: 'Use only for stationary diesel combustion.' }) @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ example: '2026-01-01' }) @IsOptional() @IsString() validFrom?: string;
  @ApiPropertyOptional({ example: '2026-12-31' }) @IsOptional() @IsString() validTo?: string;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateEmissionFactorDto extends PartialType(EmissionFactorDto) {}

export class ResourceRecordDto {
  @ApiPropertyOptional({ example: 'rec-001' }) @IsOptional() @IsString() id?: string;
  @ApiPropertyOptional({ example: 'sub-ops-2026-03' }) @IsOptional() @IsString() submissionId?: string;
  @ApiProperty({ example: 'org-techcorp' }) @IsString() @IsNotEmpty() organizationId: string;
  @ApiProperty({ example: 'dept-ops' }) @IsString() @IsNotEmpty() departmentId: string;
  @ApiProperty({ example: 'rt-diesel' }) @IsString() @IsNotEmpty() resourceTypeId: string;
  @ApiProperty({ example: 'unit-liter' }) @IsString() @IsNotEmpty() unitId: string;
  @ApiProperty({ example: 100 }) @IsNumber() @Min(0.01) quantity: number;
  @ApiProperty({ example: '2026-03-15' }) @IsString() @IsNotEmpty() activityDate: string;
  @ApiProperty({ example: '03 2026' }) @IsString() @IsNotEmpty() period: string;
  @ApiPropertyOptional({ example: 'Manual', enum: ['Manual', 'Import', 'Evidence'] }) @IsOptional() @IsIn(['Manual', 'Import', 'Evidence']) entryMode?: any;
  @ApiPropertyOptional({ example: 'ev-001' }) @IsOptional() @IsString() evidenceId?: string;
  @ApiPropertyOptional({ example: 'Ready', enum: ['Draft', 'Ready', 'Rejected'] }) @IsOptional() @IsIn(['Draft', 'Ready', 'Rejected']) status?: any;
}

export class UpdateResourceRecordDto extends PartialType(ResourceRecordDto) {}

export class EvidenceDto {
  @ApiPropertyOptional({ example: 'ev-001' }) @IsOptional() @IsString() id?: string;
  @ApiPropertyOptional({ example: 'sub-ops-2026-03' }) @IsOptional() @IsString() submissionId?: string;
  @ApiPropertyOptional({ example: 'rec-001' }) @IsOptional() @IsString() resourceRecordId?: string;
  @ApiProperty({ example: 'invoice.pdf' }) @IsString() @IsNotEmpty() fileName: string;
  @ApiProperty({ example: 'application/pdf' }) @IsString() @IsNotEmpty() fileType: string;
  @ApiPropertyOptional({ example: 1048576 }) @IsOptional() @IsNumber() fileSizeBytes?: number;
  @ApiPropertyOptional({ example: 'Uploaded' }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: { quantity: 100, unit: 'L' } }) @IsOptional() @IsObject() extractedFields?: Record<string, any>;
  @ApiPropertyOptional({ example: 'Manual evidence upload.' }) @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ example: '2026-03-15T00:00:00.000Z' }) @IsOptional() @IsString() createdAt?: string;
}

export class UpdateEvidenceDto extends PartialType(EvidenceDto) {}

export class ImportRowDto {
  @ApiPropertyOptional({ example: 'Diesel' }) @IsOptional() @IsString() resourceType?: string;
  @ApiPropertyOptional({ example: 'rt-diesel' }) @IsOptional() @IsString() resourceTypeId?: string;
  @ApiPropertyOptional({ example: 'Liters' }) @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional({ example: 'unit-liter' }) @IsOptional() @IsString() unitId?: string;
  @ApiPropertyOptional({ example: 100 }) @IsOptional() @IsNumber() quantity?: number;
  @ApiPropertyOptional({ example: '2026-03-15' }) @IsOptional() @IsString() activityDate?: string;
  @ApiPropertyOptional({ example: '03 2026' }) @IsOptional() @IsString() period?: string;
}

export class ImportBatchDto {
  @ApiPropertyOptional({ example: 'imp-001' }) @IsOptional() @IsString() id?: string;
  @ApiProperty({ example: 'org-techcorp' }) @IsString() @IsNotEmpty() organizationId: string;
  @ApiProperty({ example: 'dept-ops' }) @IsString() @IsNotEmpty() departmentId: string;
  @ApiProperty({ example: 'march-data.csv' }) @IsString() @IsNotEmpty() fileName: string;
  @ApiPropertyOptional({ example: 'Pending' }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: '2026-03-15T00:00:00.000Z' }) @IsOptional() @IsString() createdAt?: string;
  @ApiPropertyOptional({ example: 10 }) @IsOptional() @IsNumber() @Min(0) rowCount?: number;
  @ApiPropertyOptional({ example: ['rec-001'] }) @IsOptional() @IsArray() createdRecordIds?: string[];
  @ApiPropertyOptional({ type: [ImportRowDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ImportRowDto) rows?: ImportRowDto[];
}

export class UpdateImportBatchDto extends PartialType(ImportBatchDto) {}

export class ReportDto {
  @ApiPropertyOptional({ example: 'rep-001' }) @IsOptional() id?: any;
  @ApiProperty({ example: 'Emissions Report - March 2026' }) @IsString() @IsNotEmpty() title: string;
  @ApiProperty({ example: 'March 2026' }) @IsString() @IsNotEmpty() period: string;
  @ApiPropertyOptional({ example: 'org-techcorp' }) @IsOptional() @IsString() organizationId?: string;
  @ApiPropertyOptional({ example: 'Pending Review' }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: 'Michael Chen' }) @IsOptional() @IsString() analystName?: string;
  @ApiPropertyOptional({ example: 'Michael Chen' }) @IsOptional() @IsString() submittedBy?: string;
  @ApiPropertyOptional({ example: '2026-04-01T09:15:00.000Z' }) @IsOptional() @IsString() submittedAt?: string;
  @ApiPropertyOptional({ example: 'John Anderson' }) @IsOptional() @IsString() reviewedBy?: string;
  @ApiPropertyOptional({ example: 'John Anderson' }) @IsOptional() @IsString() approvedBy?: string;
  @ApiPropertyOptional({ example: '2026-04-01 10:00:00' }) @IsOptional() @IsString() approvedAt?: string;
  @ApiPropertyOptional({ example: '4/1/2026' }) @IsOptional() @IsString() decisionDate?: string;
  @ApiPropertyOptional({ example: { intro: 'Overview', analysis: 'Findings' } }) @IsOptional() @IsObject() content?: Record<string, string>;
  @ApiPropertyOptional({ example: '3/5/2026' }) @IsOptional() @IsString() date?: string;
  @ApiPropertyOptional({ example: 'amber' }) @IsOptional() @IsString() statusClass?: string;
  @ApiPropertyOptional({ example: 104 }) @IsOptional() idAnalyst?: any;
  @ApiPropertyOptional({ example: 104 }) @IsOptional() analystUserId?: any;
  @ApiPropertyOptional({ example: ['sub01', 'sub02'] }) @IsOptional() @IsArray() sourceSubmissionIds?: string[];
  @ApiPropertyOptional({ example: { signedBy: 'Analyst', signedAt: '2026-03-05T00:00:00.000Z' } }) @IsOptional() @IsObject() signature?: Record<string, any>;
  @ApiPropertyOptional({ example: { required: false, comment: '', requestedBy: '', requestedAt: '' } }) @IsOptional() @IsObject() revision?: Record<string, any>;
}

export class UpdateReportDto extends PartialType(ReportDto) {}

export class AlertDto {
  @ApiPropertyOptional({ example: 'alt-003' }) @IsOptional() @IsString() id?: string;
  @ApiPropertyOptional({ example: 'sub-001' }) @IsOptional() @IsString() submissionId?: string;
  @ApiPropertyOptional({ example: 'Submission Correction Required' }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ example: 'Threshold Breach' }) @IsString() @IsNotEmpty() type: string;
  @ApiProperty({ example: 'Critical' }) @IsString() @IsNotEmpty() severity: string;
  @ApiPropertyOptional({ example: 'org-techcorp' }) @IsOptional() @IsString() organizationId?: string;
  @ApiProperty({ example: 'dept-mfg' }) @IsString() @IsNotEmpty() departmentId: string;
  @ApiPropertyOptional({ example: 'Manufacturing' }) @IsOptional() @IsString() departmentName?: string;
  @ApiProperty({ example: 'Open' }) @IsString() @IsNotEmpty() status: string;
  @ApiProperty({ example: 'Consumption exceeded threshold.' }) @IsString() @IsNotEmpty() message: string;
  @ApiPropertyOptional({ example: ['Manager', 'COO'] }) @IsOptional() @IsArray() roleScope?: string[];
  @ApiPropertyOptional({ example: '03 2026' }) @IsOptional() @IsString() period?: string;
  @ApiPropertyOptional({ example: 'Temporary generator usage.' }) @IsOptional() @IsString() deviationReason?: string;
  @ApiPropertyOptional({ example: 'Generator test conducted.' }) @IsOptional() @IsString() managerExplanation?: string;
  @ApiPropertyOptional({ example: 'Reduced generator hours.' }) @IsOptional() @IsString() managerActionTaken?: string;
  @ApiPropertyOptional({ example: 'Robert Johnson' }) @IsOptional() @IsString() managerName?: string;
  @ApiPropertyOptional({ example: 'Limit generator operation to peak hours.' }) @IsOptional() @IsString() cooDirective?: string;
  @ApiPropertyOptional({ example: 'Provide generator log files.' }) @IsOptional() @IsString() analystClarificationNotes?: string;
  @ApiPropertyOptional({ example: 'Corrective action completed.' }) @IsOptional() @IsString() response?: string;
  @ApiPropertyOptional({ example: 'Just now' }) @IsOptional() @IsString() resolvedAt?: string;
  @ApiPropertyOptional({ example: 'John Anderson' }) @IsOptional() @IsString() resolvedBy?: string;
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
  @ApiPropertyOptional({ example: 'org-techcorp' }) @IsOptional() @IsString() organizationId?: string;
  @ApiPropertyOptional({ example: 'dept-ops' }) @IsOptional() @IsString() departmentId?: string;
  @ApiPropertyOptional({ example: 'Target Nearing' }) @IsOptional() @IsString() message?: string;
  @ApiPropertyOptional({ example: 'info' }) @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional({ example: 'Just now' }) @IsOptional() @IsString() timestamp?: string;
  @ApiPropertyOptional({ example: '2026-03-07T14:00:00.000Z' }) @IsOptional() @IsString() createdAt?: string;
}

export class UpdateNotificationDto extends PartialType(NotificationDto) {}

export class LoginDto {
  @ApiProperty({ example: 'admin@platformops.com' }) @IsEmail() email: string;
  @ApiProperty({ example: 'Admin@123' }) @IsString() @IsNotEmpty() password: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'coo@company.com', description: 'COO email address' }) @IsEmail() email: string;
  @ApiProperty({ example: 'Secure@123', description: 'Minimum 8 characters' }) @IsString() @IsNotEmpty() password: string;
  @ApiProperty({ example: 'Acme Industries', description: 'Organization name' }) @IsString() @IsNotEmpty() organizationName: string;
  @ApiProperty({ example: 'Jane Smith', description: 'COO full name' }) @IsString() @IsNotEmpty() cooName: string;
  @ApiPropertyOptional({ example: 'Operations, Manufacturing', description: 'Comma-separated department names' }) @IsOptional() @IsString() departments?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@company.com', description: 'Email of the account to reset' }) @IsEmail() email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@company.com' }) @IsEmail() email: string;
  @ApiProperty({ example: '123456', description: 'OTP code received' }) @IsString() @IsNotEmpty() otp: string;
  @ApiProperty({ example: 'NewSecure@123', description: 'New password (minimum 8 characters)' }) @IsString() @IsNotEmpty() newPassword: string;
}

export class RevisionDto {
  @ApiProperty({ example: 'Please include department variance details.' }) @IsString() @IsNotEmpty() comment: string;
  @ApiPropertyOptional({ example: 'John Anderson (COO)' }) @IsOptional() @IsString() requestedBy?: string;
}

export class ApproveReportDto {
  @ApiPropertyOptional({ example: 'John Anderson (COO)' }) @IsOptional() @IsString() approvedBy?: string;
}

export class ApproveSubmissionDto {
  @ApiPropertyOptional({ example: 'Analyst' }) @IsOptional() @IsString() approvedBy?: string;
}

export class RequestCorrectionDto {
  @ApiProperty({ example: 'Please provide updated fuel invoice.' }) @IsString() @IsNotEmpty() comment: string;
  @ApiPropertyOptional({ example: 'Analyst' }) @IsOptional() @IsString() requestedBy?: string;
}

export class ResubmitSubmissionDto {
  @ApiPropertyOptional({ example: 'Updated fuel consumption per invoice.' }) @IsOptional() @IsString() notes?: string;
}

export class ResubmitReportDto {
  @ApiPropertyOptional({ example: 'Updated Executive Summary' }) @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() content?: Record<string, any>;
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
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() resourceCategories?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() units?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() resourceTypes?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() resourceUnitCompatibilities?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() factorSources?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() factorVersions?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() emissionFactors?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() evidences?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() importBatches?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() importErrors?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() resourceRecords?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() impactCalculations?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() impactResults?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() managerSubmissions?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() submissionTracker?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() reports?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() alerts?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() notifications?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() auditLogs?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() plans?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() addons?: Record<string, any>[];
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() subscriptions?: Record<string, any>[];
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() systemMetrics?: Record<string, any>;
  @ApiPropertyOptional({ type: [Object] }) @IsOptional() @IsArray() modules?: Record<string, any>[];
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() cooKpis?: Record<string, any>;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() chartData?: Record<string, any>;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() managerChartData?: Record<string, any>;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() managerDailyUsage?: Record<string, any>;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() globalSettings?: Record<string, any>;
}
