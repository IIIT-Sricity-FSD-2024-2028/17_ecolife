import { Module } from '@nestjs/common';
import { AssuranceController } from './assurance.controller';

@Module({
  controllers: [AssuranceController]
})
export class AssuranceModule {}
