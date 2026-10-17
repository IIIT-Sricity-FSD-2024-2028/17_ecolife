import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { DbService } from '../database/db.service';
import { ViewsService } from '../database/views.service';
import { AuditLogService } from '../database/audit-log.service';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { RespondToAlertDto } from './dto/alert.dto';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly db: DbService,
    private readonly auditLog: AuditLogService,
    private readonly views: ViewsService,
  ) {}

  findAll(user: AuthenticatedOrgUser) {
    let alerts = this.db.store.alerts.filter((a) => a.organizationId === user.organizationId);
    if (user.role === 'CONTRIBUTOR') {
      if (!user.departmentId) return [];
      alerts = alerts.filter((a) => a.relatedDepartmentId === user.departmentId);
    }
    return [...alerts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((a) => this.views.alert(a));
  }

  /** Contributor, Reviewer, or Org Admin can respond. */
  respond(user: AuthenticatedOrgUser, alertId: string, dto: RespondToAlertDto) {
    const alert = this.db.store.alerts.find((a) => a.id === alertId && a.organizationId === user.organizationId);
    if (!alert) throw new NotFoundException('Alert not found.');
    // Contributors only see their own department's alerts, so they can only answer those.
    if (user.role === 'CONTRIBUTOR' && alert.relatedDepartmentId !== user.departmentId) {
      throw new NotFoundException('Alert not found.');
    }
    if (alert.status === 'RESOLVED') {
      throw new BadRequestException('This alert has already been resolved.');
    }

    const response = {
      id: this.db.id(),
      alertId,
      respondedById: user.sub,
      responseText: dto.responseText,
      action: dto.action,
      createdAt: this.db.now(),
    };
    this.db.store.alertResponses.push(response);
    alert.status = 'RESOLVED';
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'alert.responded',
      entityType: 'alert',
      entityId: alertId,
      metadata: { action: dto.action },
    });

    return response;
  }

  /** Reviewer or Org Admin can acknowledge an alert. */
  acknowledge(user: AuthenticatedOrgUser, alertId: string) {
    const alert = this.db.store.alerts.find((a) => a.id === alertId && a.organizationId === user.organizationId);
    if (!alert) throw new NotFoundException('Alert not found.');
    if (alert.status === 'RESOLVED') {
      throw new BadRequestException('This alert has already been resolved.');
    }

    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedById = user.sub;
    alert.acknowledgedAt = this.db.now();
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'alert.acknowledged',
      entityType: 'alert',
      entityId: alertId,
    });

    return this.views.alert(alert);
  }

  /** Reviewer or Org Admin can close an alert directly. */
  close(user: AuthenticatedOrgUser, alertId: string, comment?: string) {
    const alert = this.db.store.alerts.find((a) => a.id === alertId && a.organizationId === user.organizationId);
    if (!alert) throw new NotFoundException('Alert not found.');
    if (alert.status === 'RESOLVED') {
      throw new BadRequestException('This alert has already been resolved.');
    }

    alert.status = 'RESOLVED';
    const response = {
      id: this.db.id(),
      alertId,
      respondedById: user.sub,
      responseText: comment?.trim() || 'Closed by reviewer/admin.',
      action: 'closed',
      createdAt: this.db.now(),
    };
    this.db.store.alertResponses.push(response);
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'alert.closed',
      entityType: 'alert',
      entityId: alertId,
      metadata: comment ? { comment } : undefined,
    });

    return this.views.alert(alert);
  }

  /** Daily check: flags any department with no usage logged for the
   * PREVIOUS calendar month by the 5th. Ignores suspended orgs, and
   * auto-resolves previously raised alerts when usage is submitted. */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  checkOverdueSubmissions() {
    const now = new Date();
    if (now.getDate() < 5) return;

    const prevMonth = subMonths(now, 1);
    const prevMonthStart = startOfMonth(prevMonth);
    const prevMonthEnd = endOfMonth(prevMonth);
    const prevMonthStartIso = prevMonthStart.toISOString().slice(0, 10);
    const prevMonthEndIso = prevMonthEnd.toISOString().slice(0, 10);
    const monthLabel = format(prevMonth, 'MMMM yyyy');

    for (const dept of this.db.store.departments) {
      const org = this.db.store.organizations.find((o) => o.id === dept.organizationId);
      if (!org || org.status === 'SUSPENDED') continue;

      const hasEntry = this.db.store.resourceRecords.some(
        (r) =>
          r.departmentId === dept.id &&
          r.periodStart <= prevMonthEndIso &&
          r.periodEnd >= prevMonthStartIso,
      );

      const openOverdueAlerts = this.db.store.alerts.filter(
        (a) =>
          a.relatedDepartmentId === dept.id &&
          a.type === 'overdue_submission' &&
          (a.status === 'OPEN' || a.status === 'ACKNOWLEDGED'),
      );

      if (hasEntry) {
        for (const alert of openOverdueAlerts) {
          alert.status = 'RESOLVED';
          alert.message = `${alert.message} [Resolved: usage data submitted]`;
        }
        continue;
      }

      if (openOverdueAlerts.length > 0) continue;

      this.db.store.alerts.push({
        id: this.db.id(),
        organizationId: dept.organizationId,
        severity: 'WARNING',
        status: 'OPEN',
        type: 'overdue_submission',
        message: `No usage data has been logged for "${dept.name}" for last month (${monthLabel}).`,
        relatedResourceRecordId: null,
        relatedDepartmentId: dept.id,
        createdAt: this.db.now(),
      });
      this.logger.log(`Flagged overdue submission for department ${dept.name}`);
    }
    this.db.persist();
  }
}
