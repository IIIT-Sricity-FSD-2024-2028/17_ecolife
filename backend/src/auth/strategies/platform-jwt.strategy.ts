import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DbService } from '../../database/db.service';
import { AuthenticatedPlatformAdmin } from '../decorators/current-user.decorator';

/**
 * Entirely separate strategy and secret from JwtStrategy. A token issued
 * for a Platform Admin can never be validated by the org guard, and vice
 * versa — this is what makes the two login surfaces a real boundary rather
 * than just a different login page sharing one token space.
 */
@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor(config: ConfigService, private readonly db: DbService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ADMIN_SECRET')!,
    });
  }

  validate(payload: AuthenticatedPlatformAdmin) {
    const admin = this.db.store.platformAdmins.find((a) => a.id === payload.sub);
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Account is no longer active.');
    }
    return payload;
  }
}
