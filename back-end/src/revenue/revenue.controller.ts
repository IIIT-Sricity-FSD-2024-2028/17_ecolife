import { Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ok } from '../common/crud.types';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CreateAddonDto } from './dto/create-addon.dto';
import { UpdateAddonDto } from './dto/update-addon.dto';
import { RevenueService } from './revenue.service';

@ApiTags('revenue')
@Controller('revenue')
@ApiHeader({ name: 'x-role', description: 'Super User for full management; COO for organization billing.', required: true })
@ApiResponse({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } })
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) {}

  // ----------------------------------------------------
  // PLANS ENDPOINTS
  // ----------------------------------------------------
  @Get('plans')
  @Roles('Super User', 'COO')
  listPlans() {
    return ok('Revenue plans loaded.', this.revenueService.listPlans());
  }

  @Get('plans/:id')
  @Roles('Super User')
  findPlan(@Param('id') id: string) {
    return ok('Revenue plan loaded.', this.revenueService.findPlan(id));
  }

  @Post('plans')
  @Roles('Super User')
  createPlan(@Body() dto: CreatePlanDto) {
    return ok('Revenue plan created.', this.revenueService.createPlan(dto));
  }

  @Put('plans/:id')
  @Roles('Super User')
  replacePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return ok('Revenue plan updated.', this.revenueService.updatePlan(id, dto));
  }

  @Patch('plans/:id')
  @Roles('Super User')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return ok('Revenue plan updated.', this.revenueService.updatePlan(id, dto));
  }

  @Delete('plans/:id')
  @Roles('Super User')
  removePlan(@Param('id') id: string) {
    return ok('Revenue plan updated/deactivated.', this.revenueService.removePlan(id));
  }

  // ----------------------------------------------------
  // ADD-ONS ENDPOINTS
  // ----------------------------------------------------
  @Get('addons')
  @Roles('Super User', 'COO')
  listAddons() {
    return ok('Add-ons loaded.', this.revenueService.listAddons());
  }

  @Get('addons/:id')
  @Roles('Super User', 'COO')
  findAddon(@Param('id') id: string) {
    return ok('Add-on loaded.', this.revenueService.findAddon(id));
  }

  @Post('addons')
  @Roles('Super User')
  createAddon(@Body() dto: CreateAddonDto) {
    return ok('Add-on created.', this.revenueService.createAddon(dto));
  }

  @Put('addons/:id')
  @Roles('Super User')
  replaceAddon(@Param('id') id: string, @Body() dto: UpdateAddonDto) {
    return ok('Add-on updated.', this.revenueService.updateAddon(id, dto));
  }

  @Patch('addons/:id')
  @Roles('Super User')
  updateAddon(@Param('id') id: string, @Body() dto: UpdateAddonDto) {
    return ok('Add-on updated.', this.revenueService.updateAddon(id, dto));
  }

  @Delete('addons/:id')
  @Roles('Super User')
  removeAddon(@Param('id') id: string) {
    return ok('Add-on deleted/deactivated.', this.revenueService.removeAddon(id));
  }

  // ----------------------------------------------------
  // SUBSCRIPTIONS & LIFECYCLE ENDPOINTS
  // ----------------------------------------------------
  @Get('subscriptions')
  @Roles('Super User', 'COO')
  listSubscriptions(@Headers('x-role') role: string, @Headers('x-organization-id') headerOrgId: string) {
    if (role === 'COO') {
      if (!headerOrgId) {
        throw new ForbiddenException('COO organization context missing.');
      }
      const all = this.revenueService.listSubscriptions();
      const scoped = all.filter(s => s.organizationId === headerOrgId);
      return ok('Subscriptions loaded.', scoped);
    }
    return ok('Subscriptions loaded.', this.revenueService.listSubscriptions());
  }

  @Get('subscriptions/:id')
  @Roles('Super User', 'COO')
  findSubscription(@Param('id') id: string, @Headers('x-role') role: string, @Headers('x-organization-id') headerOrgId: string) {
    const sub = this.revenueService.findSubscription(id);
    if (role === 'COO' && sub.organizationId !== headerOrgId) {
      throw new ForbiddenException('Access denied to subscription of another organization.');
    }
    return ok('Subscription loaded.', sub);
  }

  @Post('subscriptions')
  @Roles('Super User', 'COO')
  createSubscription(@Body() dto: CreateSubscriptionDto, @Headers('x-role') role: string, @Headers('x-organization-id') headerOrgId: string) {
    if (role === 'COO') {
      dto.organizationId = headerOrgId;
    }
    return ok('Subscription assigned.', this.revenueService.createSubscription(dto));
  }

  @Post('subscriptions/upgrade')
  @Roles('Super User', 'COO')
  upgradeSubscription(
    @Body() body: { organizationId?: string; planId: string; billingCycle: 'MONTHLY' | 'ANNUAL'; addonIds?: string[]; customPrice?: number },
    @Headers('x-role') role: string,
    @Headers('x-organization-id') headerOrgId: string,
  ) {
    const targetOrgId = role === 'COO' ? headerOrgId : (body.organizationId || headerOrgId);
    if (!targetOrgId) {
      throw new ForbiddenException('Organization context missing.');
    }
    const result = this.revenueService.upgradeSubscription(targetOrgId, body.planId, body.billingCycle, body.addonIds, body.customPrice);
    return ok('Subscription upgraded successfully.', result);
  }

  @Post('subscriptions/:id/cancel')
  @Roles('Super User', 'COO')
  cancelSubscription(@Param('id') id: string, @Headers('x-role') role: string, @Headers('x-organization-id') headerOrgId: string) {
    const existing = this.revenueService.findSubscription(id);
    if (role === 'COO' && existing.organizationId !== headerOrgId) {
      throw new ForbiddenException('Cannot cancel subscription of another organization.');
    }
    return ok('Subscription cancelled.', this.revenueService.cancelSubscription(id));
  }

  @Post('subscriptions/:id/renew')
  @Roles('Super User', 'COO')
  renewSubscription(@Param('id') id: string, @Headers('x-role') role: string, @Headers('x-organization-id') headerOrgId: string) {
    const existing = this.revenueService.findSubscription(id);
    if (role === 'COO' && existing.organizationId !== headerOrgId) {
      throw new ForbiddenException('Cannot renew subscription of another organization.');
    }
    return ok('Subscription renewed.', this.revenueService.renewSubscription(id));
  }

  @Post('subscriptions/addons/toggle')
  @Roles('Super User', 'COO')
  toggleAddon(
    @Body() body: { organizationId?: string; addonId: string; attach: boolean },
    @Headers('x-role') role: string,
    @Headers('x-organization-id') headerOrgId: string,
  ) {
    const targetOrgId = role === 'COO' ? headerOrgId : (body.organizationId || headerOrgId);
    if (!targetOrgId) {
      throw new ForbiddenException('Organization context missing.');
    }
    const result = this.revenueService.toggleAddonForOrganization(targetOrgId, body.addonId, body.attach);
    return ok('Add-on status updated.', result);
  }

  @Post('subscriptions/expansion/buy')
  @Roles('Super User', 'COO')
  buyExpansionPack(
    @Body() body: { organizationId?: string; type: 'users' | 'departments'; count: number },
    @Headers('x-role') role: string,
    @Headers('x-organization-id') headerOrgId: string,
  ) {
    const targetOrgId = role === 'COO' ? headerOrgId : (body.organizationId || headerOrgId);
    if (!targetOrgId) {
      throw new ForbiddenException('Organization context missing.');
    }
    const result = this.revenueService.buyExpansionPack(targetOrgId, body.type, Number(body.count || 1));
    return ok(`Pre-purchased ${body.count} extra ${body.type} pack successfully.`, result);
  }

  @Post('subscriptions/expansion/manage')
  @Roles('Super User', 'COO')
  manageExpansionPack(
    @Body() body: { organizationId?: string; type: 'users' | 'departments'; action: 'ADD' | 'REMOVE' | 'SET'; count?: number },
    @Headers('x-role') role: string,
    @Headers('x-organization-id') headerOrgId: string,
  ) {
    const targetOrgId = role === 'COO' ? headerOrgId : (body.organizationId || headerOrgId);
    if (!targetOrgId) {
      throw new ForbiddenException('Organization context missing.');
    }
    const result = this.revenueService.manageExpansionPack(targetOrgId, body.type, body.action || 'ADD', Number(body.count || 1));
    return ok(`Expansion capacity for ${body.type} updated successfully (${body.action}).`, result);
  }

  @Put('subscriptions/:id')
  @Roles('Super User', 'COO')
  replaceSubscription(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto, @Headers('x-role') role: string, @Headers('x-organization-id') headerOrgId: string) {
    const existing = this.revenueService.findSubscription(id);
    if (role === 'COO') {
      if (existing.organizationId !== headerOrgId) {
        throw new ForbiddenException('Cannot modify subscription of another organization.');
      }
      dto.organizationId = headerOrgId;
    }
    return ok('Subscription updated.', this.revenueService.updateSubscription(id, dto));
  }

  @Patch('subscriptions/:id')
  @Roles('Super User', 'COO')
  updateSubscription(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto, @Headers('x-role') role: string, @Headers('x-organization-id') headerOrgId: string) {
    const existing = this.revenueService.findSubscription(id);
    if (role === 'COO') {
      if (existing.organizationId !== headerOrgId) {
        throw new ForbiddenException('Cannot modify subscription of another organization.');
      }
      dto.organizationId = headerOrgId;
    }
    return ok('Subscription updated.', this.revenueService.updateSubscription(id, dto));
  }

  @Delete('subscriptions/:id')
  @Roles('Super User')
  removeSubscription(@Param('id') id: string) {
    return ok('Subscription deleted.', this.revenueService.removeSubscription(id));
  }

  @Get('overview')
  @Roles('Super User')
  getOverview() {
    return ok('Revenue overview loaded.', this.revenueService.getOverview());
  }

  @Get('usage/:organizationId')
  @Roles('Super User', 'COO')
  getUsage(@Param('organizationId') paramOrgId: string, @Headers('x-role') role: string, @Headers('x-organization-id') headerOrgId: string) {
    const targetOrgId = role === 'COO' ? headerOrgId : paramOrgId;
    if (!targetOrgId) {
      throw new ForbiddenException('Organization context missing.');
    }
    return ok('Organization usage loaded.', this.revenueService.getOrganizationUsage(targetOrgId));
  }
}
