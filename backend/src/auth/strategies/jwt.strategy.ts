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
      algorithms: ['HS256'],
    });
  }

  /** Runs on every authenticated request; return value becomes req.user. */
  validate(payload: AuthenticatedOrgUser & { iat?: number }) {
    const user = this.db.store.orgUsers.find((u) => u.id === payload.sub);
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Account is no longer active.');
    }

    const org = this.db.store.organizations.find((o) => o.id === user.organizationId);
    if (!org || org.status === 'SUSPENDED' || org.status === 'DELETED' || org.deletedAt) {
      throw new UnauthorizedException('Your organization is no longer active.');
    }

    // A password reset/change ends every session that was issued before it.
    if (
      user.passwordChangedAt &&
      payload.iat !== undefined &&
      payload.iat < Math.floor(new Date(user.passwordChangedAt).getTime() / 1000)
    ) {
      throw new UnauthorizedException('Your password was changed. Please sign in again.');
    }

    // Authorization data comes from the database, not from the token, so a
    // role/department change takes effect immediately instead of at expiry.
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      departmentId: user.departmentId,
      isOwner: user.isOwner,
    } satisfies AuthenticatedOrgUser;
  }
}
