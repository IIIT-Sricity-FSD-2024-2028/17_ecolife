import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PlatformAuthController } from './platform-auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PlatformJwtStrategy } from './strategies/platform-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    // No default secret — every sign()/verify() call passes its own,
    // since org and platform admin tokens must never be interchangeable.
    JwtModule.register({}),
  ],
  controllers: [AuthController, PlatformAuthController],
  providers: [AuthService, JwtStrategy, PlatformJwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
