import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PlansController, BillingController } from './billing.controller';

@Module({
  controllers: [PlansController, BillingController],
  providers: [BillingService],
})
export class BillingModule {}
