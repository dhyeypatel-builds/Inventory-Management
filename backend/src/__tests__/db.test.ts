/**
 * A-04 / A-05 integration tests — require a running PostgreSQL instance
 * with migrations applied and seed data loaded.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.dev.yml up -d
 *   npx prisma migrate deploy (or migrate dev)
 *   npx prisma db seed
 *
 * The test connects via TEST_DATABASE_URL (set in src/test/setup.ts).
 */

import { prisma } from '../db/prisma';

describe('Database connection (integration)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects and queries the roles table', async () => {
    const count = await prisma.role.count();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('connects and queries the settings table', async () => {
    const count = await prisma.setting.count();
    expect(typeof count).toBe('number');
  });

  it('connects and queries the brands table', async () => {
    const brands = await prisma.brand.findMany({ take: 1 });
    expect(Array.isArray(brands)).toBe(true);
  });
});

describe('Seed data (A-05 integration)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('has ADMIN role seeded', async () => {
    const role = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    expect(role).not.toBeNull();
    expect(role?.name).toBe('ADMIN');
  });

  it('has at least 20 permissions and all assigned to ADMIN', async () => {
    const permCount = await prisma.permission.count();
    expect(permCount).toBeGreaterThanOrEqual(20);

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
    const assigned = await prisma.rolePermission.count({ where: { roleId: adminRole.id } });
    expect(assigned).toBe(permCount);
  });

  it('can find admin user by email', async () => {
    const email = process.env.ADMIN_EMAIL ?? 'admin@tyrestock.local';
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user?.isActive).toBe(true);
  });

  it('has 6 brands seeded', async () => {
    const count = await prisma.brand.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  it('has Car Tyre product type with 6 attributes', async () => {
    const pt = await prisma.productType.findUnique({
      where: { name: 'Car Tyre' },
      include: { attributes: { include: { options: true } } },
    });
    expect(pt).not.toBeNull();
    expect(pt?.attributes.length).toBe(6);

    const sizeAttr = pt?.attributes.find((a) => a.code === 'size');
    expect(sizeAttr).toBeDefined();
    expect(sizeAttr?.isVariantDefining).toBe(true);
    expect(sizeAttr?.options.length).toBe(4);
  });

  it('has default settings seeded', async () => {
    const taxSetting = await prisma.setting.findFirst({ where: { key: 'tax.default_pct' } });
    expect(taxSetting).not.toBeNull();
    expect(taxSetting?.value).toBe(18);
  });
});
