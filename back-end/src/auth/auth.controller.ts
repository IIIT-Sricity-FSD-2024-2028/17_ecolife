import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ok } from '../common/crud.types';
import { LoginDto, RegisterDto, ForgotPasswordDto, ResetPasswordDto } from '../common/base.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
@ApiHeader({ name: 'x-role', description: 'Optional role header for consistency. Auth endpoints do not enforce authentication.', required: false })
@ApiResponse({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Validate seeded credentials and return the user. No auth token is required.' })
  @ApiBody({ type: LoginDto })
  login(@Body() dto: LoginDto) {
    return ok('Login successful.', this.authService.login(dto));
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new organization with a COO account and initial departments.' })
  @ApiBody({ type: RegisterDto })
  register(@Body() dto: RegisterDto) {
    return ok('Organization registered successfully.', this.authService.register(dto));
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset OTP for the given email. Returns simulated OTP for project purposes.' })
  @ApiBody({ type: ForgotPasswordDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return ok('OTP sent.', this.authService.forgotPassword(dto));
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset account password using the OTP received from forgot-password.' })
  @ApiBody({ type: ResetPasswordDto })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return ok('Password reset successful.', this.authService.resetPassword(dto));
  }
}
