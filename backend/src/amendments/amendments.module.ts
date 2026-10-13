import { Module } from '@nestjs/common';
import { AmendmentsService } from './amendments.service';
import { AmendmentsController } from './amendments.controller';
import { CalculationsModule } from '../calculations/calculations.module';

@Module({
  imports: [CalculationsModule],
  controllers: [AmendmentsController],
  providers: [AmendmentsService],
})
export class AmendmentsModule {}
