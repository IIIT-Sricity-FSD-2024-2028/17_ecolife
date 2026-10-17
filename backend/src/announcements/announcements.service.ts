import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { Announcement } from '../database/types';
import { CreateAnnouncementDto } from './dto/announcement.dto';

const MAX_ACTIVE_PER_ORG = 20;
const DEFAULT_DAYS = 14;

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditLogService,
  ) {}

  private isActive(a: Announcement) {
    return new Date(a.expiresAt) > new Date();
  }

  private view(a: Announcement) {
    const s = this.db.store;
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      departmentId: a.departmentId,
      departmentName: a.departmentId ? s.departments.find((d) => d.id === a.departmentId)?.name ?? null : null,
      createdByName: s.orgUsers.find((u) => u.id === a.createdById)?.fullName ?? 'Former user',
      createdAt: a.createdAt,
      expiresAt: a.expiresAt,
    };
  }

  /** Org-wide notices reach everyone; a department notice reaches that department's Contributors (and all non-Contributors). */
  list(user: AuthenticatedOrgUser) {
    return this.db.store.announcements
      .filter((a) => a.organizationId === user.organizationId && this.isActive(a))
      .filter((a) => !a.departmentId || user.role !== 'CONTRIBUTOR' || a.departmentId === user.departmentId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((a) => this.view(a));
  }

  create(admin: AuthenticatedOrgUser, dto: CreateAnnouncementDto) {
    const s = this.db.store;
    if (dto.departmentId && !s.departments.some((d) => d.id === dto.departmentId && d.organizationId === admin.organizationId)) {
      throw new BadRequestException('That department does not belong to your organization.');
    }
    const active = s.announcements.filter((a) => a.organizationId === admin.organizationId && this.isActive(a)).length;
    if (active >= MAX_ACTIVE_PER_ORG) {
      throw new BadRequestException(`You already have ${MAX_ACTIVE_PER_ORG} active announcements. Remove one first.`);
    }

    const days = dto.expiresInDays ?? DEFAULT_DAYS;
    const announcement: Announcement = {
      id: this.db.id(),
      organizationId: admin.organizationId,
      createdById: admin.sub,
      title: dto.title,
      body: dto.body,
      departmentId: dto.departmentId ?? null,
      createdAt: this.db.now(),
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    };
    s.announcements.push(announcement);
    this.db.persist();

    this.audit.log({
      organizationId: admin.organizationId,
      orgUserId: admin.sub,
      action: 'announcement.created',
      entityType: 'announcement',
      entityId: announcement.id,
      metadata: { departmentId: announcement.departmentId },
    });
    return this.view(announcement);
  }

  remove(admin: AuthenticatedOrgUser, id: string) {
    const s = this.db.store;
    const index = s.announcements.findIndex((a) => a.id === id && a.organizationId === admin.organizationId);
    if (index === -1) throw new NotFoundException('Announcement not found.');
    s.announcements.splice(index, 1);
    this.db.persist();
    this.audit.log({
      organizationId: admin.organizationId,
      orgUserId: admin.sub,
      action: 'announcement.removed',
      entityType: 'announcement',
      entityId: id,
    });
  }
}
