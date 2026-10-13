import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PlatformJwtAuthGuard } from '../guards/platform-jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/** Protects a route for the org portal. Omit roles to allow any
 * authenticated org user. Usage: @OrgAuth('REVIEWER', 'ORG_ADMIN') */
export const OrgAuth = (...roles: string[]) =>
  applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), Roles(...roles), ApiBearerAuth('org-jwt'));

/** Protects a route for the admin portal. Usage: @PlatformAuth('SUPER_ADMIN') */
export const PlatformAuth = (...roles: string[]) =>
  applyDecorators(
    UseGuards(PlatformJwtAuthGuard, RolesGuard),
    Roles(...roles),
    ApiBearerAuth('admin-jwt'),
  );
