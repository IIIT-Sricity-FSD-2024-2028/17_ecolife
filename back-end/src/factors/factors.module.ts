import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { FactorsController } from './factors.controller';
import { FactorsService } from './factors.service';

@Module({
  imports: [CommonModule],
  controllers: [FactorsController],
  providers: [FactorsService],
})
export class FactorsModule {}
