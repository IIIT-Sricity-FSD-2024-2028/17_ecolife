import { Body, Controller, Delete, Get, Param, Patch, Post, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { TargetsService } from './targets.service';
import { CreateTargetDto, UpdateTargetDto } from './dto/target.dto';

@ApiTags('Targets')
@Controller('targets')
export class TargetsController {
  constructor(private readonly service: TargetsService) {}

  @Post()
  @OrgAuth('REVIEWER')
  @ApiOperation({ summary: 'Set a usage/cost/emissions target (Reviewer — owns methodology per role split)' })
  create(@CurrentUser() user: AuthenticatedOrgUser, @Body() dto: CreateTargetDto) {
    const target = this.service.create(user, dto);
    return { message: 'Target created.', data: target };
  }

  @Get()
  @OrgAuth()
  @ApiOperation({ summary: 'List targets for your organization' })
  findAll(@CurrentUser() user: AuthenticatedOrgUser) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @OrgAuth()
  @ApiOperation({ summary: 'Get a single target' })
  findOne(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user, id);
  }

  @Patch(':id')
  @OrgAuth('REVIEWER')
  @ApiOperation({ summary: 'Update a target (Reviewer)' })
  update(
    @CurrentUser() user: AuthenticatedOrgUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTargetDto,
  ) {
    const target = this.service.update(user, id, dto);
    return { message: 'Target updated.', data: target };
  }

  @Delete(':id')
  @OrgAuth('REVIEWER')
  @ApiOperation({ summary: 'Delete a target (Reviewer)' })
  remove(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user, id);
  }
}
