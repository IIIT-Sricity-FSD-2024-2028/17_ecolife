import { Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { pageResult, parsePaging } from '../../common/utils/paging.util';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Without page/pageSize: the latest 40 (what the bell shows). With them: a full paged history. ?unread=true narrows it. */
  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: Record<string, any>) {
    const where: any = { userId: user.userId, ...(q.unread === 'true' ? { isRead: false } : {}) };
    const paged = q.page !== undefined || q.pageSize !== undefined;
    const paging = paged ? parsePaging(q) : null;
    return this.prisma.withTenantTx(user.organizationId!, async (tx) => {
      if (!paging) return tx.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 40 });
      const [items, total] = await Promise.all([
        tx.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: paging.skip, take: paging.take }),
        tx.notification.count({ where })
      ]);
      return pageResult(paging, items, total);
    });
  }

  @Patch(':id/read')
  markOneRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.notification.updateMany({ where: { id, userId: user.userId }, data: { isRead: true } })
    );
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user: AuthUser) {
    await this.prisma.withTenantTx(user.organizationId!, (tx) =>
      tx.notification.updateMany({ where: { userId: user.userId, isRead: false }, data: { isRead: true } })
    );
    return { ok: true };
  }
}
