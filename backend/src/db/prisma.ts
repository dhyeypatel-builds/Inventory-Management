import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { tenancyExtension } from '../tenancy/scoped-prisma';

// In development/test, reuse the base client across hot reloads to avoid
// exhausting database connections.
const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClient };

const base =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prismaBase = base;
}

// The tenancy extension auto-scopes every tenant-owned model by the current
// request's tenant (Phase 2A U-02). Services import this extended client.
export const prisma = base.$extends(tenancyExtension);

/** The base (unscoped) client. Use only for genuinely cross-tenant/system work. */
export const prismaBase = base;

export type ExtendedPrismaClient = typeof prisma;

/**
 * The interactive-transaction client of the extended PrismaClient. Use this in
 * place of `Prisma.TransactionClient` for functions that receive a `tx` from
 * `prisma.$transaction`, since the extension changes the client's type.
 */
export type TxClient = Omit<
  ExtendedPrismaClient,
  '$connect' | '$disconnect' | '$on' | '$use' | '$transaction' | '$extends'
>;
