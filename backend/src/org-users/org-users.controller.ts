import { Body, Controller, Delete, Get, Param, Patch, Post, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { OrgUsersService } from './org-users.service';
import { InviteOrgUserDto, UpdateOrgUserDto } from './dto/org-user.dto';

@ApiTags('Org Users')
@Controller('org-users')
export class OrgUsersController {
  constructor(private readonly service: OrgUsersService) {}

  @Post()
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: 'Invite a new user to your organization (Org Admin only)' })
  async invite(@CurrentUser() actor: AuthenticatedOrgUser, @Body() dto: InviteOrgUserDto) {
    const user = await this.service.invite(actor, dto);
    return { message: 'User invited successfully.', data: user };
  }

  @Get()
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: 'List all users in your organization (Org Admin only)' })
  findAll(@CurrentUser() actor: AuthenticatedOrgUser) {
    return this.service.findAll(actor);
  }

  @Get(':id')
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: 'Get a single user' })
  findOne(@CurrentUser() actor: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(actor, id);
  }

  @Patch(':id')
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: 'Update a user (role, department, active status)' })
  update(@CurrentUser() actor: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrgUserDto) {
    const user = this.service.update(actor, id, dto);
    return { message: 'User updated.', data: user };
  }

  @Delete(':id')
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: 'Deactivate a user (soft-delete only, preserves audit history)' })
  deactivate(@CurrentUser() actor: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    const user = this.service.deactivate(actor, id);
    return { message: 'User deactivated.', data: user };
  }
}
