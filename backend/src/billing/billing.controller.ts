import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAuth, PlatformAuth } from '../auth/decorators/protected.decorator';
import {
  CurrentUser,
  AuthenticatedOrgUser,
  AuthenticatedPlatformAdmin,
} from '../auth/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import { ChangePlanDto, CreatePlanDto } from './dto/billing.dto';

@ApiTags('Billing — Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly service: BillingService) {}

  @Post()
  @PlatformAuth('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a subscription plan (Platform Admin)' })
  create(@CurrentUser() admin: AuthenticatedPlatformAdmin, @Body() dto: CreatePlanDto) {
    const plan = this.service.createPlan(admin, dto);
    return { message: 'Plan created.', data: plan };
  }

  @Get()
  @ApiOperation({ summary: 'List available plans (public catalog)' })
  findAll() {
    return this.service.listPlans();
  }
}

@ApiTags('Billing — Subscription')
@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('subscription')
  @OrgAuth()
  @ApiOperation({ summary: "View your organization's current plan/subscription" })
  getSubscription(@CurrentUser() user: AuthenticatedOrgUser) {
    return this.service.getMySubscription(user);
  }

  @Get('invoices')
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: "View your organization's mock invoice history (Org Admin)" })
  getInvoices(@CurrentUser() user: AuthenticatedOrgUser) {
    return this.service.getMyInvoices(user);
  }

  @Post('change-plan')
  @OrgAuth('ORG_ADMIN')
  @ApiOperation({ summary: "Change your organization's plan (Org Admin)" })
  changePlan(@CurrentUser() user: AuthenticatedOrgUser, @Body() dto: ChangePlanDto) {
    const sub = this.service.changePlan(user, dto);
    return { message: 'Plan changed successfully.', data: sub };
  }
}
