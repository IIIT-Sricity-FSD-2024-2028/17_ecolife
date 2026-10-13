import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';

@ApiTags('Auth — Org Portal')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register-organization')
  @ApiOperation({
    summary: 'Self-service organization signup',
    description:
      'Creates a new Organization and its first user as the protected Owner (ORG_ADMIN, isOwner=true).',
  })
  @ApiBody({ type: RegisterOrganizationDto })
  @ApiResponse({ status: 201, description: 'Organization and owner created.' })
  async registerOrganization(@Body() dto: RegisterOrganizationDto) {
    const result = await this.authService.registerOrganization(dto);
    return { message: 'Organization created successfully.', data: result };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
  @ApiOperation({ summary: 'Reset password using a valid token' })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
