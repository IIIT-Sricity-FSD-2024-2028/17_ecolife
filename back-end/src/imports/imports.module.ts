import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [CommonModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
