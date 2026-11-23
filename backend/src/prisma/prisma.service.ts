import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
    });
  }

  async onModuleInit() {
    await this.$connect();
    await this.assertRestrictedRole();
  }

  /**
   * Row-level security protects each company's data only if the API connects as an ordinary role.
   * A superuser (or a role with BYPASSRLS) skips every policy silently, so refuse to start as one.
   * ALLOW_SUPERUSER_DB=true is a development escape hatch and is ignored in production.
   */
  private async assertRestrictedRole() {
    const rows = await this.$queryRaw<{ rolname: string; unsafe: boolean }[]>`SELECT rolname, (rolsuper OR rolbypassrls) AS unsafe FROM pg_roles WHERE rolname = current_user`;
    const r = rows[0];
    if (!r?.unsafe) return;
    const override = process.env.ALLOW_SUPERUSER_DB === 'true' && process.env.NODE_ENV !== 'production';
    const msg = `The database role "${r.rolname}" can bypass row-level security, so one company could see another's data. Connect as the restricted role (see README, "Database") instead.`;
    if (!override) throw new Error(msg);
    // eslint-disable-next-line no-console
    console.warn(`WARNING: ${msg} Continuing only because ALLOW_SUPERUSER_DB=true.`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Executes a callback inside a PostgreSQL transaction with tenant FORCE RLS GUC bound locally.
   */
  async withTenantTx<T>(
    organizationId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'false', true)`;
      return fn(tx);
    });
  }

  /**
   * Pre-tenant identity context (login, session validation). Binds ONLY the caller's own user id
   * (and optionally the login e-mail) so RLS exposes that single user row and its roles.
   */
  async withAuthTx<T>(
    ctx: { userId?: string; email?: string },
    fn: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'false', true)`;
      await tx.$executeRaw`SELECT set_config('app.auth_user_id', ${ctx.userId ?? ''}, true)`;
      await tx.$executeRaw`SELECT set_config('app.auth_email', ${ctx.email ?? ''}, true)`;
      return fn(tx);
    });
  }

  /**
   * Executes a callback with Platform Admin RLS context (tenant lifecycle, global factors, GWP).
   */
  async withPlatformTx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
      return fn(tx);
    });
  }

  /**
   * Resolves a pre-auth token (Supplier OTP Portal or Team Invitation) safely under FORCE RLS.
   */
  async withTokenLookupTx<T>(
    gucName: 'app.supplier_token_hash' | 'app.invite_token_hash' | 'app.api_key_hash',
    tokenHash: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config(${gucName}, ${tokenHash}, true)`;
      return fn(tx);
    });
  }
}
