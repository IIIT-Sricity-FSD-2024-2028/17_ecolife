"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotDto = exports.UpdateAuditLogDto = exports.AuditLogDto = exports.AlertResponseDto = exports.ApproveReportDto = exports.RevisionDto = exports.LoginDto = exports.UpdateNotificationDto = exports.NotificationDto = exports.UpdateAlertDto = exports.AlertDto = exports.UpdateReportDto = exports.ReportDto = exports.UpdateSubmissionDto = exports.SubmissionDto = exports.UpdateDepartmentDto = exports.DepartmentDto = exports.UpdateOrganizationDto = exports.OrganizationDto = exports.UpdateUserDto = exports.UserDto = exports.ResourceDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class ResourceDto {
    type;
    unit;
    qty;
    emissionFactor;
    co2;
}
exports.ResourceDto = ResourceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Diesel' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ResourceDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Liters' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ResourceDto.prototype, "unit", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 2500 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    __metadata("design:type", Number)
], ResourceDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2.68 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ResourceDto.prototype, "emissionFactor", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 6700 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ResourceDto.prototype, "co2", void 0);
class UserDto {
    id;
    name;
    role;
    email;
    password;
    department;
    departmentId;
    assignedDepartmentIds;
    organizationId;
    phone;
    status;
    lastLogin;
}
exports.UserDto = UserDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 105 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UserDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'New Manager' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UserDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Manager', enum: ['Super User', 'COO', 'Manager', 'Analyst'] }),
    (0, class_validator_1.IsIn)(['Super User', 'COO', 'Manager', 'Analyst']),
    __metadata("design:type", Object)
], UserDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'asha@tc.com' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], UserDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Default@123' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UserDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Operations' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UserDto.prototype, "department", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'dept-ops' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UserDto.prototype, "departmentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: ['dept-ops'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UserDto.prototype, "assignedDepartmentIds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'org-tc' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UserDto.prototype, "organizationId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '5550198236' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UserDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Active', enum: ['Active', 'Inactive', 'Pending'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['Active', 'Inactive', 'Pending']),
    __metadata("design:type", Object)
], UserDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Apr 01, 2026, 09:00 AM' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UserDto.prototype, "lastLogin", void 0);
class UpdateUserDto extends (0, swagger_1.PartialType)(UserDto) {
}
exports.UpdateUserDto = UpdateUserDto;
class OrganizationDto {
    id;
    name;
    industry;
    cooName;
    cooUserId;
    cooEmail;
    target;
    threshold;
    departmentIds;
    current;
    co2;
    status;
    statusType;
    registrationStatus;
    registrationStatusType;
}
exports.OrganizationDto = OrganizationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'org-acme' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrganizationDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Acme Industries' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], OrganizationDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Manufacturing' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], OrganizationDto.prototype, "industry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'COO Name' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrganizationDto.prototype, "cooName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 102 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], OrganizationDto.prototype, "cooUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'coo@acme.com' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], OrganizationDto.prototype, "cooEmail", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '10,000 L' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrganizationDto.prototype, "target", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '11,000 L' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrganizationDto.prototype, "threshold", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: ['dept-ops'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], OrganizationDto.prototype, "departmentIds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '9,500 L' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrganizationDto.prototype, "current", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '25,000' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrganizationDto.prototype, "co2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Within Target' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrganizationDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'green' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrganizationDto.prototype, "statusType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Approved' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrganizationDto.prototype, "registrationStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'green' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OrganizationDto.prototype, "registrationStatusType", void 0);
class UpdateOrganizationDto extends (0, swagger_1.PartialType)(OrganizationDto) {
}
exports.UpdateOrganizationDto = UpdateOrganizationDto;
class DepartmentDto {
    id;
    orgId;
    name;
    manager;
    managerUserId;
    target;
    threshold;
    orgName;
    current;
    co2;
    status;
    statusType;
    resourceTargets;
}
exports.DepartmentDto = DepartmentDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'dept-energy' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DepartmentDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'org-tc' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DepartmentDto.prototype, "orgId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Energy' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DepartmentDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Unassigned' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DepartmentDto.prototype, "manager", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 103 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], DepartmentDto.prototype, "managerUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '5,000 L' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DepartmentDto.prototype, "target", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '5,500 L' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DepartmentDto.prototype, "threshold", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'TC Works' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DepartmentDto.prototype, "orgName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '4,800 L' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DepartmentDto.prototype, "current", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '12,500' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DepartmentDto.prototype, "co2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Within Target' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DepartmentDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'green' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DepartmentDto.prototype, "statusType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], DepartmentDto.prototype, "resourceTargets", void 0);
class UpdateDepartmentDto extends (0, swagger_1.PartialType)(DepartmentDto) {
}
exports.UpdateDepartmentDto = UpdateDepartmentDto;
class SubmissionDto {
    id;
    organizationId;
    departmentId;
    period;
    resources;
    managerName;
    managerUserId;
    validation;
    departmentName;
    status;
    score;
    submittedAt;
    resubmittedAt;
    totalConsumption;
    totalCO2;
    locked;
}
exports.SubmissionDto = SubmissionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'sub-001' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmissionDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'org-tc' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SubmissionDto.prototype, "organizationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'dept-ops' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SubmissionDto.prototype, "departmentId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '03 2026' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SubmissionDto.prototype, "period", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [ResourceDto] }),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SubmissionDto.prototype, "resources", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Asha' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmissionDto.prototype, "managerName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 103 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], SubmissionDto.prototype, "managerUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: { state: 'valid', anomalyScore: 0, deviationReason: '' } }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SubmissionDto.prototype, "validation", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Operations' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmissionDto.prototype, "departmentName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Pending' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmissionDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Evaluating' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmissionDto.prototype, "score", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Apr 01, 2026' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmissionDto.prototype, "submittedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-05-05 10:30:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmissionDto.prototype, "resubmittedAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 4800 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], SubmissionDto.prototype, "totalConsumption", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 12000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], SubmissionDto.prototype, "totalCO2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SubmissionDto.prototype, "locked", void 0);
class UpdateSubmissionDto extends (0, swagger_1.PartialType)(SubmissionDto) {
}
exports.UpdateSubmissionDto = UpdateSubmissionDto;
class ReportDto {
    id;
    title;
    period;
    organizationId;
    status;
    analystName;
    content;
    date;
    statusClass;
    analystUserId;
    sourceSubmissionIds;
    signature;
    revision;
    version;
    versions;
    reviewedBy;
    reviewedByUserId;
    decisionDate;
    resubmittedAt;
}
exports.ReportDto = ReportDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 9003 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ReportDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Emissions Report - March 2026' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ReportDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'March 2026' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ReportDto.prototype, "period", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'org-tc' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReportDto.prototype, "organizationId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Pending Review' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReportDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Meera' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReportDto.prototype, "analystName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: { intro: 'Overview', analysis: 'Findings' } }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ReportDto.prototype, "content", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '3/5/2026' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReportDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'amber' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReportDto.prototype, "statusClass", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 104 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ReportDto.prototype, "analystUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: ['sub01', 'sub02'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], ReportDto.prototype, "sourceSubmissionIds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: { signedBy: 'Analyst', signedAt: '2026-03-05T00:00:00.000Z' } }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ReportDto.prototype, "signature", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: { required: false, comment: '', requestedBy: '', requestedAt: '' } }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ReportDto.prototype, "revision", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ReportDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: [] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], ReportDto.prototype, "versions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Rajesh Kumar' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReportDto.prototype, "reviewedBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 102 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ReportDto.prototype, "reviewedByUserId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '3/7/2026' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReportDto.prototype, "decisionDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '3/8/2026' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReportDto.prototype, "resubmittedAt", void 0);
class UpdateReportDto extends (0, swagger_1.PartialType)(ReportDto) {
}
exports.UpdateReportDto = UpdateReportDto;
class AlertDto {
    id;
    type;
    severity;
    organizationId;
    departmentId;
    departmentName;
    status;
    message;
    roleScope;
    deviationReason;
    response;
    createdAt;
    updatedAt;
}
exports.AlertDto = AlertDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'alt-003' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AlertDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Threshold Breach' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AlertDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Critical' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AlertDto.prototype, "severity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'org-tc' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AlertDto.prototype, "organizationId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'dept-mfg' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AlertDto.prototype, "departmentId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Manufacturing' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AlertDto.prototype, "departmentName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Open' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AlertDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Consumption exceeded threshold.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AlertDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: ['Manager', 'COO'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], AlertDto.prototype, "roleScope", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Temporary generator usage.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AlertDto.prototype, "deviationReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Corrective action completed.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AlertDto.prototype, "response", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-03-07 14:00:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AlertDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-03-07 14:00:00' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AlertDto.prototype, "updatedAt", void 0);
class UpdateAlertDto extends (0, swagger_1.PartialType)(AlertDto) {
}
exports.UpdateAlertDto = UpdateAlertDto;
class NotificationDto {
    id;
    role;
    title;
    body;
    read;
    details;
    userId;
    message;
    type;
    timestamp;
    createdAt;
}
exports.NotificationDto = NotificationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 10 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], NotificationDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Manager', enum: ['Super User', 'COO', 'Manager', 'Analyst'] }),
    (0, class_validator_1.IsIn)(['Super User', 'COO', 'Manager', 'Analyst']),
    __metadata("design:type", Object)
], NotificationDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Target Nearing' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], NotificationDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Operations is nearing threshold.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], NotificationDto.prototype, "body", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], NotificationDto.prototype, "read", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Extra details' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], NotificationDto.prototype, "details", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 103 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], NotificationDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Target Nearing' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], NotificationDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'info' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], NotificationDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Just now' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], NotificationDto.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-03-07T14:00:00.000Z' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], NotificationDto.prototype, "createdAt", void 0);
class UpdateNotificationDto extends (0, swagger_1.PartialType)(NotificationDto) {
}
exports.UpdateNotificationDto = UpdateNotificationDto;
class LoginDto {
    email;
    password;
}
exports.LoginDto = LoginDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'admin@rorizon.com' }),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], LoginDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Admin@123' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], LoginDto.prototype, "password", void 0);
class RevisionDto {
    comment;
    requestedBy;
}
exports.RevisionDto = RevisionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Please include department variance details.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RevisionDto.prototype, "comment", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Rajesh (COO)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RevisionDto.prototype, "requestedBy", void 0);
class ApproveReportDto {
    approvedBy;
}
exports.ApproveReportDto = ApproveReportDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Rajesh (COO)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApproveReportDto.prototype, "approvedBy", void 0);
class AlertResponseDto {
    response;
}
exports.AlertResponseDto = AlertResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Corrective action completed.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AlertResponseDto.prototype, "response", void 0);
class AuditLogDto {
    id;
    timestamp;
    actor;
    action;
    status;
    statusType;
    ip;
}
exports.AuditLogDto = AuditLogDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1714520000000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AuditLogDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-04-01 09:15:00' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AuditLogDto.prototype, "timestamp", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'System Admin (Super User)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AuditLogDto.prototype, "actor", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'User Updated' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AuditLogDto.prototype, "action", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Success' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AuditLogDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'green' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AuditLogDto.prototype, "statusType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '127.0.0.1' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AuditLogDto.prototype, "ip", void 0);
class UpdateAuditLogDto extends (0, swagger_1.PartialType)(AuditLogDto) {
}
exports.UpdateAuditLogDto = UpdateAuditLogDto;
class SnapshotDto {
    version;
    users;
    organizations;
    departments;
    submissions;
    managerSubmissions;
    submissionTracker;
    reports;
    alerts;
    notifications;
    auditLogs;
    systemMetrics;
    modules;
    cooKpis;
    chartData;
    managerChartData;
    managerDailyUsage;
    globalSettings;
}
exports.SnapshotDto = SnapshotDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 6 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], SnapshotDto.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SnapshotDto.prototype, "users", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SnapshotDto.prototype, "organizations", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SnapshotDto.prototype, "departments", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SnapshotDto.prototype, "submissions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SnapshotDto.prototype, "managerSubmissions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SnapshotDto.prototype, "submissionTracker", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SnapshotDto.prototype, "reports", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SnapshotDto.prototype, "alerts", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SnapshotDto.prototype, "notifications", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SnapshotDto.prototype, "auditLogs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Object }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SnapshotDto.prototype, "systemMetrics", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [Object] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], SnapshotDto.prototype, "modules", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Object }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SnapshotDto.prototype, "cooKpis", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Object }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SnapshotDto.prototype, "chartData", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Object }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SnapshotDto.prototype, "managerChartData", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Object }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SnapshotDto.prototype, "managerDailyUsage", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: Object }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SnapshotDto.prototype, "globalSettings", void 0);
//# sourceMappingURL=base.dto.js.map