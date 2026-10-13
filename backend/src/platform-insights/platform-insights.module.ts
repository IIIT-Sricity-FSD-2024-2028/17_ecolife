import { Module } from '@nestjs/common';
import { PlatformInsightsController } from './platform-insights.controller';
import { PlatformInsightsService } from './platform-insights.service';

@Module({ controllers: [PlatformInsightsController], providers: [PlatformInsightsService] })
export class PlatformInsightsModule {}
