import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from './decorators/public.decorator';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResendVerificationDto, ResetPasswordDto, VerifyEmailDto } from './dto/password-reset.dto';

@ApiTags('Auth — Org Portal')
@Public() // every route here is the pre-login surface; each one carries its own @Throttle
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('maintenance-status')
  @ApiOperation({ summary: 'Check if platform is currently in maintenance mode' })
  maintenanceStatus() {
    return this.authService.getMaintenanceStatus();
  }

  @Post('register-organization')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } }) // sign-ups: 5 per hour per IP
  @ApiOperation({
    summary: 'Self-service organization signup',
    description:
      'Creates a new Organization and its first user as the protected Owner (ORG_ADMIN, isOwner=true). The account can sign in immediately; no token is returned.',
  })
  @ApiBody({ type: RegisterOrganizationDto })
  @ApiResponse({ status: 201, description: 'Organization and owner created.' })
  async registerOrganization(@Body() dto: RegisterOrganizationDto) {
    const result = await this.authService.registerOrganization(dto);
    return { message: 'Organization created. You can now sign in.', data: result };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Org portal login (Org Admin, Contributor, Reviewer, Executive)' })
  @ApiBody({ type: LoginDto })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.loginOrgUser(dto);
    return { message: 'Login successful.', data: result };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset (org portal)' })
  @ApiBody({ type: ForgotPasswordDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto, 'org');
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reset password using a valid token' })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto, 'org');
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Confirm an email address using the emailed token' })
  @ApiBody({ type: VerifyEmailDto })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a new verification link (same response whether or not the email exists)' })
  @ApiBody({ type: ResendVerificationDto })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }
}
