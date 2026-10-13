import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { startOfMonth, isAfter, isEqual } from 'date-fns';
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
    if (user.role === 'CONTRIBUTOR' && user.departmentId) {
      alerts = alerts.filter((a) => a.relatedDepartmentId === user.departmentId);
    }
    return [...alerts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((a) => this.views.alert(a));
  }

  /** Contributor or Org Admin can respond — the person closest to the data
   * and the person accountable for the org. */
  respond(user: AuthenticatedOrgUser, alertId: string, dto: RespondToAlertDto) {
    const alert = this.db.store.alerts.find((a) => a.id === alertId && a.organizationId === user.organizationId);
    if (!alert) throw new NotFoundException('Alert not found.');
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

  /** Daily check: flags any department with no resource record at all for
   * the current calendar month by the 5th. */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  checkOverdueSubmissions() {
    const now = new Date();
    if (now.getDate() < 5) return;

    const monthStart = startOfMonth(now);
    const onOrAfterMonthStart = (dateIso: string) => {
      const d = new Date(dateIso);
      return isAfter(d, monthStart) || isEqual(d, monthStart);
    };

    for (const dept of this.db.store.departments) {
      const hasEntry = this.db.store.resourceRecords.some(
        (r) => r.departmentId === dept.id && onOrAfterMonthStart(r.periodStart),
      );
      if (hasEntry) continue;

      const alreadyFlagged = this.db.store.alerts.some(
        (a) => a.relatedDepartmentId === dept.id && a.type === 'overdue_submission' && onOrAfterMonthStart(a.createdAt),
      );
      if (alreadyFlagged) continue;

      this.db.store.alerts.push({
        id: this.db.id(),
        organizationId: dept.organizationId,
        severity: 'WARNING',
        status: 'OPEN',
        type: 'overdue_submission',
        message: `No usage data has been logged for "${dept.name}" this month.`,
        relatedResourceRecordId: null,
        relatedDepartmentId: dept.id,
        createdAt: this.db.now(),
      });
      this.logger.log(`Flagged overdue submission for department ${dept.name}`);
    }
    this.db.persist();
  }
}
