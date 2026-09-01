import { Module } from '@nestjs/common';
import { RevenueModule } from '../revenue/revenue.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [RevenueModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
