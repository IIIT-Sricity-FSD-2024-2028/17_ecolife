import { Module } from '@nestjs/common';
import { ValueChainController } from './value-chain.controller';

@Module({
  controllers: [ValueChainController]
})
export class ValueChainModule {}
