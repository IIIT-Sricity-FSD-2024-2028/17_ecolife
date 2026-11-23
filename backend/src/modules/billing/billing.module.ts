import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { PaymentsController } from './payments.controller';

@Module({
  controllers: [BillingController, PaymentsController]
})
export class BillingModule {}
