import { Module } from '@nestjs/common';
import { ImportsReportsController } from './imports-reports.controller';

@Module({
  controllers: [ImportsReportsController]
})
export class ImportsReportsModule {}
