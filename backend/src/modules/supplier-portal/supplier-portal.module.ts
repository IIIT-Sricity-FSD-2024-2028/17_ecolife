import { Module } from '@nestjs/common';
import { SupplierPortalController } from './supplier-portal.controller';

@Module({
  controllers: [SupplierPortalController]
})
export class SupplierPortalModule {}
