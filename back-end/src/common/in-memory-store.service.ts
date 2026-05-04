import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Entity } from './crud.types';
import { Alert, Department, Report, RorizonDb, Submission, User } from '../in-memory/entities';
import { seedDb } from '../in-memory/seed';

@Injectable()
export class InMemoryStoreService {
  private state: RorizonDb = this.normalize(seedDb());

  snapshot(): RorizonDb {
    return structuredClone(this.state);
  }

  replace(snapshot: Partial<RorizonDb>): RorizonDb {
    this.state = this.normalize({ ...this.state, ...snapshot });
    this.log('Runtime Snapshot Sync', 'Success', 'green', 'System');
    return this.snapshot();
  }

  list<T extends Entity>(key: keyof RorizonDb): T[] {
    return structuredClone(this.state[key] as T[]);
  }

  find<T extends Entity>(key: keyof RorizonDb, id: string | number): T {
    const entity = (this.state[key] as T[]).find((item) => String(item.id) === String(id));
    if (!entity) throw new NotFoundException(`${String(key)} record ${id} not found.`);
    return structuredClone(entity);
  }

  create<T extends Entity>(key: keyof RorizonDb, payload: Omit<T, 'id'> & Partial<Entity>, prefix: string): T {
    const collection = this.state[key] as T[];
    const id = payload.id ?? `${prefix}-${randomUUID().slice(0, 8)}`;
    if (collection.some((item) => String(item.id) === String(id))) {
      throw new BadRequestException(`${String(key)} record ${id} already exists.`);
    }
    this.assertUnique(key, payload as Partial<Entity>, id);
    const entity = { ...payload, id } as T;
    collection.unshift(entity);
    this.normalize(this.state);
    this.log(`${String(key)} Created`, 'Success', 'green');
    return structuredClone(entity);
  }

  update<T extends Entity>(key: keyof RorizonDb, id: string | number, payload: Partial<T>): T {
    const collection = this.state[key] as T[];
    const index = collection.findIndex((item) => String(item.id) === String(id));
    if (index < 0) throw new NotFoundException(`${String(key)} record ${id} not found.`);
    this.assertUnique(key, payload as Partial<Entity>, id);
    collection[index] = { ...collection[index], ...payload };
    this.normalize(this.state);
    this.log(`${String(key)} Updated`, 'Success', 'green');
    return structuredClone(collection[index]);
  }

  remove<T extends Entity>(key: keyof RorizonDb, id: string | number): T {
    const collection = this.state[key] as T[];
    const index = collection.findIndex((item) => String(item.id) === String(id));
    if (index < 0) throw new NotFoundException(`${String(key)} record ${id} not found.`);
    const [entity] = collection.splice(index, 1);
    this.normalize(this.state);
    this.log(`${String(key)} Deleted`, 'Success', 'green');
    return structuredClone(entity);
  }

  authenticate(email: string, password: string): User {
    const user = this.state.users.find((entry) => entry.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) {
      this.log(`Failed login attempt for ${email}`, 'Blocked', 'red', 'Anonymous');
      throw new BadRequestException('Invalid email or password.');
    }
    if (user.status !== 'Active') throw new BadRequestException('Account is not active.');
    if (this.state.globalSettings?.flagMain && user.role !== 'Super User') {
      this.log(`Maintenance-mode login blocked for ${email}`, 'Blocked', 'amber', `${user.name} (${user.role})`);
      throw new BadRequestException('System is under maintenance. Please try again later or contact the Super User.');
    }
    user.lastLogin = new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    this.log('Successful login', 'Success', 'green', `${user.name} (${user.role})`);
    return structuredClone(user);
  }

  lockSubmission(payload: Partial<Submission>): Submission {
    if (!payload.departmentId || !payload.organizationId) throw new BadRequestException('departmentId and organizationId are required.');
    if (!payload.resources?.length) throw new BadRequestException('At least one resource is required.');
    const department = this.state.departments.find((entry) => entry.id === payload.departmentId);
    if (!department) throw new NotFoundException('Department not found.');

    const totalConsumption = payload.resources.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const totalCO2 = payload.resources.reduce((sum, item) => sum + Number(item.qty || 0) * 2.5, 0);
    const threshold = this.parseAmount(department.threshold || department.target);
    const breach = threshold > 0 && totalConsumption > threshold;
    if (breach && !payload.validation?.deviationReason) {
      throw new BadRequestException('Deviation reason is required when threshold is breached.');
    }

    const submission: Submission = {
      id: payload.id || `sub-${randomUUID().slice(0, 8)}`,
      organizationId: payload.organizationId,
      departmentId: payload.departmentId,
      departmentName: department.name,
      managerName: payload.managerName || department.manager,
      managerUserId: payload.managerUserId ?? department.managerUserId,
      period: payload.period || new Date().toISOString().slice(0, 7),
      status: payload.status || 'Pending',
      score: payload.score || 'Evaluating',
      submittedAt: payload.submittedAt || new Date().toLocaleString(),
      resources: payload.resources,
      totalConsumption,
      totalCO2,
      validation: {
        state: breach ? 'threshold_breach' : payload.validation?.state || 'valid',
        anomalyScore: payload.validation?.anomalyScore || 0,
        deviationReason: payload.validation?.deviationReason || '',
      },
      locked: true,
    };

    this.state.submissions.unshift(submission);
    this.state.managerSubmissions.unshift({
      id: submission.id,
      organizationId: submission.organizationId,
      departmentId: submission.departmentId,
      departmentName: submission.departmentName,
      managerUserId: submission.managerUserId,
      period: submission.period,
      status: submission.status,
      score: submission.score,
      submittedAt: submission.submittedAt,
      resources: submission.resources,
      totalConsumption,
      totalCO2,
    });
    department.current = `${totalConsumption.toLocaleString()} Units`;
    department.co2 = totalCO2.toLocaleString();
    department.status = breach ? 'Exceeded' : 'Within Target';
    department.statusType = breach ? 'red' : 'green';
    this.upsertTracker(department, submission);
    if (breach) this.createBreachAlert(department, submission, threshold);
    this.state.notifications.unshift({
      id: Date.now(),
      role: 'Analyst',
      organizationId: department.orgId,
      departmentId: department.id,
      title: 'New Locked Submission',
      body: `${department.name} submitted ${submission.period} resource data.`,
      timestamp: 'Just now',
      read: false,
      details: `Submission ${submission.id} is ready for analyst review.`,
    });
    this.recalculateOrganization(department.orgId);
    this.log(`Locked Submission: ${department.name} ${submission.period}`, breach ? 'Warning' : 'Success', breach ? 'amber' : 'green', `${submission.managerName} (Manager)`);
    return structuredClone(submission);
  }

  approveReport(id: number, approvedBy: string): Report {
    const report = this.state.reports.find((entry) => entry.id === id);
    if (!report) throw new NotFoundException('Report not found.');
    report.status = 'Approved';
    report.statusClass = 'green';
    report.revision = { required: false, comment: '', requestedBy: '', requestedAt: '' };
    this.log(`Report Approved: ${report.title}`, 'Success', 'green', approvedBy || 'COO');
    return structuredClone(report);
  }

  requestReportRevision(id: number, comment: string, requestedBy: string): Report {
    if (!comment?.trim()) throw new BadRequestException('Revision comment is required.');
    const report = this.state.reports.find((entry) => entry.id === id);
    if (!report) throw new NotFoundException('Report not found.');
    report.status = 'Revision Required';
    report.statusClass = 'red';
    report.revision = { required: true, comment, requestedBy, requestedAt: new Date().toISOString() };
    this.log(`Report Revision Requested: ${report.title}`, 'Warning', 'amber', requestedBy || 'COO');
    return structuredClone(report);
  }

  respondToAlert(id: string, response: string): Alert {
    if (!response?.trim()) throw new BadRequestException('Alert response is required.');
    const alert = this.state.alerts.find((entry) => entry.id === id);
    if (!alert) throw new NotFoundException('Alert not found.');
    alert.response = response;
    alert.status = 'Resolved';
    alert.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    this.log(`Alert Resolved: ${alert.departmentName}`, 'Success', 'green');
    return structuredClone(alert);
  }

  log(action: string, status = 'Success', statusType = 'green', actor = 'System') {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    this.state.auditLogs.unshift({ id: Date.now(), timestamp: now, actor, action, status, statusType, ip: '127.0.0.1' });
    if (this.state.auditLogs.length > 200) this.state.auditLogs.length = 200;
  }

  private normalize(state: RorizonDb): RorizonDb {
    state.globalSettings = state.globalSettings || {
      lockout: '5',
      session: '240',
      otpExp: '15',
      maxUsers: '100',
      flagMain: false,
      flagEmail: true,
      flag2fa: false,
    };
    state.users = Array.isArray(state.users) ? state.users : [];
    state.organizations = Array.isArray(state.organizations) ? state.organizations : [];
    state.departments = Array.isArray(state.departments) ? state.departments : [];
    state.submissions = Array.isArray(state.submissions) ? state.submissions : [];
    state.reports = Array.isArray(state.reports) ? state.reports : [];
    state.alerts = Array.isArray(state.alerts) ? state.alerts : [];
    state.notifications = Array.isArray(state.notifications) ? state.notifications : [];
    state.auditLogs = Array.isArray(state.auditLogs) ? state.auditLogs : [];
    state.departments.forEach((dept) => {
      const org = state.organizations.find((entry) => entry.id === dept.orgId);
      dept.orgName = org?.name || dept.orgName || '';
      const manager = state.users.find((entry) => entry.id === dept.managerUserId || entry.departmentId === dept.id);
      if (manager && manager.role === 'Manager') {
        dept.managerUserId = manager.id;
        dept.manager = manager.name;
        manager.department = dept.name;
        manager.departmentId = dept.id;
        manager.organizationId = dept.orgId;
      }
      const latestSubmission = this.latestSubmissionForDepartment(state, dept.id);
      if (latestSubmission) {
        const target = this.parseAmount(dept.target);
        const threshold = this.parseAmount(dept.threshold || dept.target);
        dept.current = `${Number(latestSubmission.totalConsumption || 0).toLocaleString()} Units`;
        dept.co2 = Number(latestSubmission.totalCO2 || 0).toLocaleString();
        if (threshold > 0 && Number(latestSubmission.totalConsumption || 0) > threshold) {
          dept.status = 'Exceeded';
          dept.statusType = 'red';
        } else if (target > 0 && Number(latestSubmission.totalConsumption || 0) > target) {
          dept.status = 'Approaching';
          dept.statusType = 'amber';
        } else {
          dept.status = 'Within Target';
          dept.statusType = 'green';
        }
      }
    });
    state.organizations.forEach((org) => {
      org.departmentIds = state.departments.filter((dept) => dept.orgId === org.id).map((dept) => dept.id);
      const coo = state.users.find((entry) => entry.id === org.cooUserId || (entry.role === 'COO' && entry.organizationId === org.id));
      if (coo) {
        org.cooUserId = coo.id;
        org.cooName = coo.name;
        org.cooEmail = coo.email;
        coo.organizationId = org.id;
        coo.department = '';
        coo.departmentId = '';
        coo.assignedDepartmentIds = [];
      }
      this.recalculateOrganization(org.id, state);
    });
    state.users.forEach((user) => {
      if (user.role === 'Manager') {
        const department = state.departments.find((dept) => dept.id === user.departmentId || dept.managerUserId === user.id);
        if (department) {
          user.departmentId = department.id;
          user.department = department.name;
          user.organizationId = department.orgId;
        }
      }
      if (user.role === 'Analyst' && Array.isArray(user.assignedDepartmentIds) && user.assignedDepartmentIds.length) {
        const assignedDepartment = state.departments.find((dept) => user.assignedDepartmentIds.includes(dept.id));
        if (assignedDepartment) user.organizationId = assignedDepartment.orgId;
      }
    });
    state.submissions.forEach((submission) => {
      const department = state.departments.find((dept) => dept.id === submission.departmentId);
      if (!department) return;
      const manager = state.users.find((entry) => entry.id === department.managerUserId);
      submission.organizationId = department.orgId;
      submission.departmentName = department.name;
      submission.managerUserId = department.managerUserId;
      submission.managerName = manager?.name || department.manager || submission.managerName;
      submission.totalConsumption = (submission.resources || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
      submission.totalCO2 = submission.totalConsumption * 2.5;
    });
    state.reports.forEach((report) => {
      if (report.organizationId) return;
      const source = state.submissions.find((submission) => report.sourceSubmissionIds?.includes(submission.id));
      if (source) report.organizationId = source.organizationId;
    });
    state.alerts.forEach((alert) => {
      const department = state.departments.find((dept) => dept.id === alert.departmentId);
      if (!department) return;
      alert.organizationId = department.orgId;
      alert.departmentName = department.name;
    });
    state.submissionTracker = state.departments.map((department) => {
      const latestSubmission = this.latestSubmissionForDepartment(state, department.id);
      return {
        id: department.id,
        orgId: department.orgId,
        name: department.name,
        manager: department.manager || 'Unassigned',
        status: latestSubmission ? 'submitted' : 'pending',
        consumption: latestSubmission ? `${Number(latestSubmission.totalConsumption || 0).toLocaleString()} Units` : '--',
        submittedAt: latestSubmission?.submittedAt || '--',
      };
    });
    state.managerSubmissions = state.submissions.map((sub) => ({
      id: sub.id,
      organizationId: sub.organizationId,
      departmentId: sub.departmentId,
      departmentName: sub.departmentName,
      managerUserId: sub.managerUserId,
      period: sub.period,
      status: sub.status,
      score: sub.score,
      submittedAt: sub.submittedAt,
      resources: sub.resources,
      totalConsumption: sub.totalConsumption,
      totalCO2: sub.totalCO2,
    }));
    return state;
  }

  private assertUnique(key: keyof RorizonDb, payload: Partial<Entity>, currentId?: string | number) {
    if (key === 'users' && 'email' in payload && payload.email) {
      const duplicateUser = this.state.users.find((user) =>
        String(user.id) !== String(currentId ?? '') &&
        user.email.toLowerCase() === String(payload.email).toLowerCase()
      );
      if (duplicateUser) throw new BadRequestException('A user with this email already exists.');
    }

    if (key === 'organizations' && 'name' in payload && payload.name) {
      const duplicateOrganization = this.state.organizations.find((organization) =>
        String(organization.id) !== String(currentId ?? '') &&
        organization.name.toLowerCase() === String(payload.name).toLowerCase()
      );
      if (duplicateOrganization) throw new BadRequestException('An organization with this name already exists.');
    }
  }

  private recalculateOrganization(orgId: string, state = this.state) {
    const org = state.organizations.find((entry) => entry.id === orgId);
    if (!org) return;
    const departments = state.departments.filter((dept) => dept.orgId === orgId);
    const target = departments.reduce((sum, dept) => sum + this.parseAmount(dept.target), 0);
    const threshold = departments.reduce((sum, dept) => sum + this.parseAmount(dept.threshold), 0);
    const current = departments.reduce((sum, dept) => sum + this.parseAmount(dept.current), 0);
    const co2 = departments.reduce((sum, dept) => sum + this.parseAmount(dept.co2), 0);
    org.target = `${target.toLocaleString()} Units`;
    org.threshold = `${threshold.toLocaleString()} Units`;
    org.current = `${current.toLocaleString()} Units`;
    org.co2 = co2.toLocaleString();
    const hasBreach = departments.some((dept) => dept.statusType === 'red');
    const overTarget = departments.some((dept) => dept.statusType === 'amber') || (target > 0 && current > target);
    org.status = hasBreach || overTarget ? 'Needs Attention' : 'Within Target';
    org.statusType = hasBreach || overTarget ? 'amber' : 'green';
  }

  private upsertTracker(department: Department, submission: Submission) {
    let tracker = this.state.submissionTracker.find((item) => item.id === department.id);
    if (!tracker) {
      tracker = { id: department.id, orgId: department.orgId, name: department.name, manager: department.manager };
      this.state.submissionTracker.push(tracker);
    }
    Object.assign(tracker, {
      status: 'submitted',
      consumption: `${submission.totalConsumption.toLocaleString()} Units`,
      submittedAt: submission.submittedAt,
    });
  }

  private createBreachAlert(department: Department, submission: Submission, threshold: number) {
    this.state.alerts.unshift({
      id: `alt-${randomUUID().slice(0, 8)}`,
      type: 'Threshold Breach',
      severity: 'Critical',
      roleScope: ['Manager', 'COO'],
      organizationId: submission.organizationId,
      departmentId: department.id,
      departmentName: department.name,
      status: 'Open',
      message: `System detected consumption exceeding the monthly threshold by ${(submission.totalConsumption - threshold).toLocaleString()} units.`,
      deviationReason: submission.validation.deviationReason,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
  }

  private parseAmount(value: string) {
    const match = String(value || '').replace(/,/g, '').match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  private latestSubmissionForDepartment(state: RorizonDb, departmentId: string): Submission | undefined {
    return state.submissions
      .filter((submission) => submission.departmentId === departmentId)
      .sort((a, b) => this.periodKey(b.period) - this.periodKey(a.period))[0];
  }

  private periodKey(period: string) {
    const match = String(period || '').match(/(\d{1,2})\s+(\d{4})/);
    return match ? Number(match[2]) * 100 + Number(match[1]) : 0;
  }
}
