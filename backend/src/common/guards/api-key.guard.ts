import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface ApiKeyContext {
  organizationId: string;
  facilityIds: string[];
  apiKeyId: string;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const rawKey = req.headers['x-tropos-api-key'];
    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('Missing X-Tropos-Api-Key header');
    }
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    // ApiKey is under FORCE RLS: resolve it by exact hash first, then touch it inside its own tenant context.
    const key = await this.prisma.withTokenLookupTx('app.api_key_hash', keyHash, (tx) => tx.apiKey.findUnique({ where: { keyHash } }));
    if (!key || !key.isActive || key.revokedAt || (key.expiresAt && key.expiresAt < new Date())) {
      throw new UnauthorizedException('This access key is not valid. It may have been revoked or expired. Create a new key in Settings.');
    }
    if (!key.scopes.includes('ingest:entries')) throw new ForbiddenException('This API key is not allowed to ingest entries.');
    await this.prisma.withTenantTx(key.organizationId, async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: key.organizationId }, select: { status: true } });
      if (org.status === 'SUSPENDED' || org.status === 'CLOSED') throw new ForbiddenException('This organization is suspended or closed.');
      if (!key.lastUsedAt || key.lastUsedAt.getTime() < Date.now() - 60_000) await tx.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    });
    req.apiKeyAuth = {
      organizationId: key.organizationId,
      facilityIds: key.facilityIds,
      apiKeyId: key.id
    } as ApiKeyContext;
    return true;
  }
}
