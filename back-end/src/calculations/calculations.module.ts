import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { CalculationsController } from './calculations.controller';
import { CalculationsService } from './calculations.service';

@Module({
  imports: [CommonModule],
  controllers: [CalculationsController],
  providers: [CalculationsService],
})
export class CalculationsModule {}
