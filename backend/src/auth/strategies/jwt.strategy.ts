import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DbService } from '../../database/db.service';
import { AuthenticatedOrgUser } from '../decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly db: DbService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  /** Runs on every authenticated request; return value becomes req.user. */
  validate(payload: AuthenticatedOrgUser) {
    const user = this.db.store.orgUsers.find((u) => u.id === payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is no longer active.');
    }

    const org = this.db.store.organizations.find((o) => o.id === user.organizationId);
    if (org?.status === 'SUSPENDED') {
      throw new UnauthorizedException('Your organization has been suspended.');
    }

    return payload;
  }
}
