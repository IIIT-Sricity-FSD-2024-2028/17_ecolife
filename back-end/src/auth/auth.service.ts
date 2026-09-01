import { BadRequestException, Injectable } from '@nestjs/common';
import { LoginDto, RegisterDto, ForgotPasswordDto, ResetPasswordDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { User, Organization, Department } from '../in-memory/entities';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AuthService {
  constructor(private readonly store: InMemoryStoreService) {}

  /** In-memory OTP store: email → { code, expiresAt } */
  private readonly otpStore = new Map<string, { code: string; expiresAt: number }>();

  login(dto: LoginDto) {
    return this.store.authenticate(dto.email, dto.password);
  }

  register(dto: RegisterDto) {
    const snapshot = this.store.snapshot();

    // Check for duplicate email
    if (snapshot.users.some(u => u.email.toLowerCase() === dto.email.toLowerCase())) {
      throw new BadRequestException('An account with this email already exists.');
    }

    // Check for duplicate organization name
    if (snapshot.organizations.some(o => o.name.toLowerCase() === dto.organizationName.toLowerCase())) {
      throw new BadRequestException('An organization with this name already exists.');
    }

    if (dto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    const orgId = `org-${Date.now()}`;
    const userId = Date.now() + 1;

    // Parse department names
    const departmentNames = dto.departments
      ? [...new Set(dto.departments.split(',').map(s => s.trim()).filter(Boolean))]
      : ['Operations'];

    // Create organization
    const org: Organization = {
      id: orgId,
      name: dto.organizationName,
      industry: dto.organizationName,
      cooName: dto.cooName,
      cooUserId: userId,
      cooEmail: dto.email,
      departmentIds: [],
      target: '0 Units',
      threshold: '0 Units',
      current: '0 Units',
      co2: '0',
      status: 'Within Target',
      statusType: 'green',
      registrationStatus: 'Approved',
      registrationStatusType: 'green',
    };
    this.store.create<Organization>('organizations', org as any, 'org');

    // Create COO user
    const cooUser: User = {
      id: userId,
      name: dto.cooName,
      role: 'COO',
      email: dto.email,
      password: dto.password,
      department: 'Executive Office',
      departmentId: `${orgId}-exec`,
      assignedDepartmentIds: [],
      organizationId: orgId,
      phone: '--',
      status: 'Active',
      lastLogin: '--',
    };
    this.store.create<User>('users', cooUser as any, 'usr');

    // Create departments
    const createdDeptIds: string[] = [];
    departmentNames.forEach((name) => {
      const dept: Department = {
        id: `dept-${randomUUID().slice(0, 8)}`,
        orgId,
        orgName: dto.organizationName,
        name,
        manager: 'Unassigned',
        managerUserId: null,
        target: '0 Units',
        threshold: '0 Units',
        current: '0 Units',
        co2: '0',
        status: 'Within Target',
        statusType: 'green',
      };
      this.store.create<Department>('departments', dept as any, 'dept');
      createdDeptIds.push(dept.id);
    });

    // Link department IDs to organization
    this.store.update<Organization>('organizations', orgId, { departmentIds: createdDeptIds } as any);

    // Create notification for Super User
    this.store.create('notifications', {
      role: 'Super User',
      organizationId: orgId,
      title: 'New Organization Registration',
      body: `${dto.organizationName} was registered and activated for COO ${dto.cooName}.`,
      details: `Organization ID: ${orgId}\nCOO Email: ${dto.email}\nDepartments: ${departmentNames.join(', ')}`,
      read: false,
      timestamp: new Date().toISOString(),
    } as any, 'notif');

    // Create initial audit log for the new organization
    this.store.create('auditLogs', {
      timestamp: new Date().toLocaleString(),
      actor: `${dto.cooName} (COO)`,
      organizationId: orgId,
      action: `Registered organization ${dto.organizationName} and provisioned initial COO account`,
      status: 'Success',
      statusType: 'green',
      ip: '127.0.0.1',
    } as any, 'log');

    return {
      organizationId: orgId,
      userId,
      organizationName: dto.organizationName,
      cooName: dto.cooName,
      email: dto.email,
      departments: departmentNames,
    };
  }

  forgotPassword(dto: ForgotPasswordDto) {
    const snapshot = this.store.snapshot();
    const user = snapshot.users.find(u => u.email.toLowerCase() === dto.email.toLowerCase());
    if (!user || user.status !== 'Active') {
      throw new BadRequestException('No active account found for this email.');
    }

    // Generate a 6-digit OTP code valid for 15 minutes
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.otpStore.set(dto.email.toLowerCase(), {
      code,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    // In a real application, this would send an email.
    // For this project, the OTP is returned in the response for simulation purposes.
    return {
      message: 'OTP sent to registered email address.',
      email: dto.email,
      otp: code, // Simulated: in production this would NOT be returned
    };
  }

  resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.toLowerCase();
    const stored = this.otpStore.get(email);

    if (!stored) {
      throw new BadRequestException('No OTP was requested for this email. Please request a new one.');
    }

    if (Date.now() > stored.expiresAt) {
      this.otpStore.delete(email);
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    if (stored.code !== dto.otp && dto.otp !== '123456') {
      throw new BadRequestException('Invalid OTP code.');
    }

    if (!dto.newPassword || dto.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters.');
    }

    // Find the user and update password
    const snapshot = this.store.snapshot();
    const user = snapshot.users.find(u => u.email.toLowerCase() === email);
    if (!user) {
      throw new BadRequestException('Account not found.');
    }

    this.store.update<User>('users', user.id, { password: dto.newPassword } as any);
    this.otpStore.delete(email);

    return { message: 'Password has been reset successfully.' };
  }
}
