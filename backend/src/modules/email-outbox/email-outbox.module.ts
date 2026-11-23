import { Module } from '@nestjs/common';
import { EmailOutboxController, EmailOutboxService } from './email-outbox.controller';

@Module({
  controllers: [EmailOutboxController],
  providers: [EmailOutboxService],
  exports: [EmailOutboxService]
})
export class EmailOutboxModule {}
