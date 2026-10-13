import { Module } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { ResourcesController, FactorsController } from './resources.controller';

@Module({
  controllers: [ResourcesController, FactorsController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
