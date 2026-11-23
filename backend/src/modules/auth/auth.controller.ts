import { Body, Controller, Get, Headers, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import {
  acceptInviteDtoSchema,
  changePasswordDtoSchema,
  disable2faDtoSchema,
  enable2faDtoSchema,
  forgotPasswordDtoSchema,
  LoginDto,
  loginDtoSchema,
  RegisterDto,
  registerDtoSchema,
  resetPasswordDtoSchema,
  verifyEmailDtoSchema
} from './dto/auth.dto';

@ApiTags('Authentication & 2FA')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(RateLimitGuard)
  login(
    @Body(new ZodValidationPipe(loginDtoSchema)) dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') ua?: string
  ) {
    return this.authService.login(dto, ip, ua);
  }

  @Post('register')
  @UseGuards(RateLimitGuard)
  register(
    @Body(new ZodValidationPipe(registerDtoSchema)) dto: RegisterDto,
    @Ip() ip: string,
    @Headers('user-agent') ua?: string
  ) {
    return this.authService.register(dto, ip, ua);
  }

  @Post('logout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.userId, user.sessionId);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.userId);
  }


  @Post('resend-verification')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  resendVerification(@CurrentUser() user: AuthUser) {
    return this.authService.resendVerification(user.userId, user.email, user.organizationId);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  changePassword(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(changePasswordDtoSchema)) body: { currentPassword: string; newPassword: string }) {
    return this.authService.changePassword(user.userId, user.sessionId, body.currentPassword, body.newPassword);
  }

  @Post('verify-email')
  @UseGuards(RateLimitGuard)
  verifyEmail(@Body(new ZodValidationPipe(verifyEmailDtoSchema)) body: { token: string }) {
    return this.authService.verifyEmail(body.token);
  }

  @Post('forgot-password')
  @UseGuards(RateLimitGuard)
  forgotPassword(@Body(new ZodValidationPipe(forgotPasswordDtoSchema)) body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @UseGuards(RateLimitGuard)
  resetPassword(@Body(new ZodValidationPipe(resetPasswordDtoSchema)) body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Post('2fa/setup')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  setup2fa(@CurrentUser() user: AuthUser) {
    return this.authService.setup2fa(user.userId, user.email);
  }

  @Post('2fa/enable')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  enable2fa(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(enable2faDtoSchema)) body: { code: string }) {
    return this.authService.enable2fa(user.userId, body.code);
  }

  @Post('2fa/disable')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  disable2fa(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(disable2faDtoSchema)) body: { password: string; code?: string; recoveryCode?: string }) {
    return this.authService.disable2fa(user.userId, body.password, body.code, body.recoveryCode);
  }

  @Get('invitations/:token')
  @UseGuards(RateLimitGuard)
  getInvitation(@Param('token') token: string) {
    return this.authService.getInvitation(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(RateLimitGuard)
  acceptInvitation(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(acceptInviteDtoSchema)) body: { fullName: string; password: string },
    @Ip() ip: string,
    @Headers('user-agent') ua?: string
  ) {
    return this.authService.acceptInvitation(token, body.fullName, body.password, ip, ua);
  }
}
