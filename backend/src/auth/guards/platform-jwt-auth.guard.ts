import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Verifies an admin-portal JWT (Super Admin, Platform Admin). Entirely
 * separate token space from JwtAuthGuard — see PlatformJwtStrategy. */
@Injectable()
export class PlatformJwtAuthGuard extends AuthGuard('platform-jwt') {}
