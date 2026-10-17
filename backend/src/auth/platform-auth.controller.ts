import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from './decorators/public.decorator';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';

/** Entirely separate route namespace and JWT secret from the org portal's
 * /auth. No self-service registration here: Platform Admins are created
 * only by an existing Super Admin. */
@ApiTags('Auth — Admin Portal')
@Public() // pre-login surface for the admin portal; each route carries its own @Throttle
@Controller('admin-auth')
export class PlatformAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Admin portal login (Super Admin, Platform Admin)' })
  @ApiBody({ type: LoginDto })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.loginPlatformAdmin(dto);
    return { message: 'Login successful.', data: result };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset (admin portal)' })
  @ApiBody({ type: ForgotPasswordDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto, 'platform');
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reset password using a valid token' })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto, 'platform');
  }
}
