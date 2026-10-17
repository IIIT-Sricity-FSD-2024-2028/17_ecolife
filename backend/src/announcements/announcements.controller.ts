import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/announcement.dto';

@ApiTags('Announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @Get()
  @OrgAuth()
  @ApiOperation({ summary: 'Active announcements for you (organization-wide, plus your department)' })
  list(@CurrentUser() user: AuthenticatedOrgUser) {
    return this.service.list(user);
  }

  @Post()
  @OrgAuth('ORG_ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Post an announcement to the organization or one department (Org Admin)' })
  create(@CurrentUser() admin: AuthenticatedOrgUser, @Body() dto: CreateAnnouncementDto) {
    const data = this.service.create(admin, dto);
    return { message: 'Announcement posted.', data };
  }

  @Delete(':id')
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: 'Remove an announcement (Org Admin)' })
  remove(@CurrentUser() admin: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    this.service.remove(admin, id);
    return { message: 'Announcement removed.', data: null };
  }
}
