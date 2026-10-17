import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { CommentTargetDto, CreateCommentDto } from './dto/comment.dto';

const MAX_COMMENTS_PER_ITEM = 200;

/**
 * Comment threads on records, reports and amendments. A thread is visible to exactly the people who can
 * already see the item, so a conversation can never leak data across the existing boundaries:
 *   - record: anyone in the organization; a Contributor only for their own department
 *   - report / amendment: Reviewer, Executive and Org Admin (Contributors never see these)
 * Every failure is the same 404 so an id from another organization can't be probed.
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditLogService,
  ) {}

  private assertAccess(user: AuthenticatedOrgUser, target: CommentTargetDto) {
    const s = this.db.store;
    const notFound = new NotFoundException('Item not found.');

    if (target.entityType === 'resource_record') {
      const rec = s.resourceRecords.find((r) => r.id === target.entityId && r.organizationId === user.organizationId);
      if (!rec) throw notFound;
      if (user.role === 'CONTRIBUTOR' && rec.departmentId !== user.departmentId) throw notFound;
      return;
    }

    if (user.role === 'CONTRIBUTOR') throw notFound;

    if (target.entityType === 'report') {
      if (!s.reports.some((r) => r.id === target.entityId && r.organizationId === user.organizationId)) throw notFound;
      return;
    }

    const amendment = s.amendments.find((a) => a.id === target.entityId);
    const rec = amendment && s.resourceRecords.find((r) => r.id === amendment.resourceRecordId && r.organizationId === user.organizationId);
    if (!rec) throw notFound;
  }

  private view(c: { id: string; authorId: string; authorRole: string; body: string; createdAt: string }) {
    const author = this.db.store.orgUsers.find((u) => u.id === c.authorId);
    return {
      id: c.id,
      authorId: c.authorId,
      authorName: author?.fullName ?? 'Former user',
      authorRole: c.authorRole,
      body: c.body,
      createdAt: c.createdAt,
    };
  }

  list(user: AuthenticatedOrgUser, target: CommentTargetDto) {
    this.assertAccess(user, target);
    return this.db.store.comments
      .filter((c) => c.organizationId === user.organizationId && c.entityType === target.entityType && c.entityId === target.entityId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .map((c) => this.view(c));
  }

  create(user: AuthenticatedOrgUser, dto: CreateCommentDto) {
    this.assertAccess(user, dto);

    const existing = this.db.store.comments.filter(
      (c) => c.organizationId === user.organizationId && c.entityType === dto.entityType && c.entityId === dto.entityId,
    ).length;
    if (existing >= MAX_COMMENTS_PER_ITEM) {
      throw new BadRequestException('This thread has reached its comment limit.');
    }

    const comment = {
      id: this.db.id(),
      organizationId: user.organizationId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      authorId: user.sub,
      authorRole: user.role,
      body: dto.body,
      createdAt: this.db.now(),
    };
    this.db.store.comments.push(comment);
    this.db.persist();

    this.audit.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'comment.created',
      entityType: dto.entityType,
      entityId: dto.entityId,
      metadata: { commentId: comment.id },
    });
    return this.view(comment);
  }
}
