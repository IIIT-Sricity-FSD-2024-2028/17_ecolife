import { Body, Controller, Get, Param, Post, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAuth } from '../auth/decorators/protected.decorator';
import { CurrentUser, AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';
import { AmendmentsService } from './amendments.service';
import { DecideAmendmentDto, ProposeAmendmentDto } from './dto/amendment.dto';

@ApiTags('Amendments')
@Controller()
export class AmendmentsController {
  constructor(private readonly service: AmendmentsService) {}

  @Post('resource-records/:recordId/amendments')
  @OrgAuth('REVIEWER')
  @ApiOperation({ summary: 'Propose a correction to a locked entry (Reviewer)' })
  propose(
    @CurrentUser() user: AuthenticatedOrgUser,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body() dto: ProposeAmendmentDto,
  ) {
    const amendment = this.service.propose(user, recordId, dto);
    return { message: 'Amendment proposed, pending Executive approval.', data: amendment };
  }

  @Get('amendments')
  @OrgAuth('REVIEWER', 'EXECUTIVE', 'ORG_ADMIN')
  @ApiOperation({ summary: 'List every amendment in your organization' })
  findAllInOrg(@CurrentUser() user: AuthenticatedOrgUser) {
    return this.service.findAll(user);
  }

  @Get('resource-records/:recordId/amendments')
  @OrgAuth()
  @ApiOperation({ summary: 'List amendment history for a resource record' })
  findAll(@CurrentUser() user: AuthenticatedOrgUser, @Param('recordId', ParseUUIDPipe) recordId: string) {
    return this.service.findAllForRecord(user, recordId);
  }

  @Post('amendments/:id/approve')
  @OrgAuth('EXECUTIVE')
  @ApiOperation({
    summary: 'Approve an amendment (Executive)',
    description:
      'Leadership sign-off on a restatement of official data. Applies the correction, recalculates, and flags dependent approved reports for revision if the change exceeds the 5% materiality threshold.',
  })
  approve(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideAmendmentDto) {
    const amendment = this.service.approve(user, id, dto);
    return { message: 'Amendment approved and applied.', data: amendment };
  }

  @Post('amendments/:id/reject')
  @OrgAuth('EXECUTIVE')
  @ApiOperation({ summary: 'Reject a proposed amendment (Executive)' })
  reject(@CurrentUser() user: AuthenticatedOrgUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideAmendmentDto) {
    return this.service.reject(user, id, dto);
  }
}
