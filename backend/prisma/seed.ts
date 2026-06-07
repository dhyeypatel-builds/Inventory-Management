import { PrismaClient, AttributeDatatype } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// The well-known default tenant that all Phase 1 data belongs to (see the
// multitenancy_foundation migration). Phase 2A transitional anchor.
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// All permission codes granted to ADMIN in Phase 1
const PERMISSIONS = [
  'catalog:read',
  'catalog:write',
  'product:read',
  'product:write',
  'inventory:read',
  'inventory:write',
  'sale:read',
  'sale:create',
  'sale:cancel',
  'sale:return',
  'customer:read',
  'customer:write',
  'dashboard:read',
  'report:read',
  'report:export',
  'alert:read',
  'alert:acknowledge',
  'settings:read',
  'settings:write',
  'audit:read',
  'team:manage',
];

const BRANDS = ['Michelin', 'Dunlop', 'Pirelli', 'Continental', 'Goodyear', 'Bridgestone'];

const CATEGORIES = [
  { name: 'Car', slug: 'car' },
  { name: 'Bike', slug: 'bike' },
  { name: 'Truck', slug: 'truck' },
  { name: 'Bus', slug: 'bus' },
  { name: 'Tractor', slug: 'tractor' },
  { name: 'SUV', slug: 'suv' },
  { name: 'EV', slug: 'ev' },
  { name: 'Off-road', slug: 'off-road' },
];

interface AttributeDef {
  code: string;
  label: string;
  datatype: AttributeDatatype;
  isRequired: boolean;
  isVariantDefining: boolean;
  displayOrder: number;
  options: string[];
}

const CAR_TYRE_ATTRIBUTES: AttributeDef[] = [
  {
    code: 'size',
    label: 'Tyre Size',
    datatype: 'ENUM',
    isRequired: true,
    isVariantDefining: true,
    displayOrder: 1,
    options: ['145/80 R12', '165/80 R14', '195/65 R15', '205/55 R16'],
  },
  {
    code: 'tyre_type',
    label: 'Tyre Type',
    datatype: 'ENUM',
    isRequired: true,
    isVariantDefining: true,
    displayOrder: 2,
    options: ['Tubeless', 'Tube Type', 'Radial', 'Bias'],
  },
  {
    code: 'vehicle_type',
    label: 'Vehicle Type',
    datatype: 'ENUM',
    isRequired: false,
    isVariantDefining: false,
    displayOrder: 3,
    options: ['Hatchback', 'Sedan', 'SUV', 'Truck', 'Bike', 'Scooter', 'Tractor'],
  },
  {
    code: 'position',
    label: 'Position',
    datatype: 'ENUM',
    isRequired: false,
    isVariantDefining: false,
    displayOrder: 4,
    options: ['Front', 'Rear', 'Universal'],
  },
  {
    code: 'terrain',
    label: 'Terrain',
    datatype: 'ENUM',
    isRequired: false,
    isVariantDefining: false,
    displayOrder: 5,
    options: ['Highway', 'City', 'Off-road', 'Mud Terrain', 'All Terrain'],
  },
  {
    code: 'pattern',
    label: 'Pattern',
    datatype: 'TEXT',
    isRequired: false,
    isVariantDefining: false,
    displayOrder: 6,
    options: [],
  },
];

const DEFAULT_SETTINGS = [
  { key: 'company.name', value: 'TyreStock' as unknown as object },
  { key: 'company.phone', value: '' as unknown as object },
  { key: 'company.address', value: '' as unknown as object },
  { key: 'company.vat_number', value: '' as unknown as object },
  { key: 'tax.default_pct', value: 20 as unknown as object },
  { key: 'inventory.default_reorder_level', value: 5 as unknown as object },
];

async function main(): Promise<void> {
  console.log('🌱 Starting seed...');

  // ─── Default tenant ────────────────────────────────────────────────────────
  // All Phase 1 seed data lives in this tenant. The migration creates it; we
  // upsert here so the seed is self-sufficient after `migrate reset`.
  await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    // The default shop ships with seed data, so it's considered already onboarded.
    update: { onboardingCompletedAt: new Date() },
    create: {
      id: DEFAULT_TENANT_ID,
      name: 'Default Shop',
      slug: 'default',
      onboardingCompletedAt: new Date(),
    },
  });
  console.log('  ✓ default tenant');

  // ─── Platform admin (master admin — lives outside all tenants) ─────────────
  const platformEmail = process.env.PLATFORM_ADMIN_EMAIL ?? 'owner@tyrestock.app';
  const platformPassword = process.env.PLATFORM_ADMIN_PASSWORD ?? 'Platform@1234';
  const platformFullName = process.env.PLATFORM_ADMIN_FULL_NAME ?? 'Platform Owner';
  const platformHash = await argon2.hash(platformPassword, { type: argon2.argon2id });
  await prisma.platformAdmin.upsert({
    where: { email: platformEmail },
    update: {},
    create: { email: platformEmail, fullName: platformFullName, passwordHash: platformHash },
  });
  console.log(`  ✓ platform admin: ${platformEmail}`);

  // ─── Permissions ───────────────────────────────────────────────────────────
  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }
  console.log(`  ✓ ${PERMISSIONS.length} permissions`);

  // ─── ADMIN role ────────────────────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Full access to all system features' },
  });

  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }
  console.log(`  ✓ ADMIN role with ${allPermissions.length} permissions`);

  // ─── Staff roles (Phase 2C — assignable via staff invites) ─────────────────
  const STAFF_ROLES: { name: string; description: string; permissions: string[] }[] = [
    {
      name: 'SALES',
      description: 'Point of sale and customers',
      permissions: [
        'catalog:read', 'product:read', 'inventory:read', 'sale:read', 'sale:create',
        'sale:cancel', 'sale:return', 'customer:read', 'customer:write', 'dashboard:read',
        'alert:read',
      ],
    },
    {
      name: 'INVENTORY',
      description: 'Catalog and stock management',
      permissions: [
        'catalog:read', 'catalog:write', 'product:read', 'product:write', 'inventory:read',
        'inventory:write', 'alert:read', 'alert:acknowledge', 'dashboard:read', 'report:read',
      ],
    },
    {
      name: 'AUDITOR',
      description: 'Read-only access plus reports and audit log',
      permissions: [
        'catalog:read', 'product:read', 'inventory:read', 'sale:read', 'customer:read',
        'dashboard:read', 'report:read', 'report:export', 'alert:read', 'settings:read',
        'audit:read',
      ],
    },
  ];
  const permByCode = new Map(allPermissions.map((p) => [p.code, p.id]));
  for (const role of STAFF_ROLES) {
    const r = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
    for (const code of role.permissions) {
      const permissionId = permByCode.get(code);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: r.id, permissionId } },
        update: {},
        create: { roleId: r.id, permissionId },
      });
    }
  }
  console.log(`  ✓ ${STAFF_ROLES.length} staff roles (SALES, INVENTORY, AUDITOR)`);

  // ─── Admin user ────────────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@tyrestock.local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin@1234';
  const adminFullName = process.env.ADMIN_FULL_NAME ?? 'System Admin';

  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      tenantId: DEFAULT_TENANT_ID,
      email: adminEmail,
      fullName: adminFullName,
      passwordHash,
      roleId: adminRole.id,
    },
  });
  console.log(`  ✓ Admin user: ${adminEmail}`);

  // ─── Brands ────────────────────────────────────────────────────────────────
  for (const name of BRANDS) {
    await prisma.brand.upsert({
      where: { tenantId_name: { tenantId: DEFAULT_TENANT_ID, name } },
      update: {},
      create: { tenantId: DEFAULT_TENANT_ID, name },
    });
  }
  console.log(`  ✓ ${BRANDS.length} brands`);

  // ─── Categories ────────────────────────────────────────────────────────────
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { tenantId_slug: { tenantId: DEFAULT_TENANT_ID, slug: cat.slug } },
      update: {},
      create: { tenantId: DEFAULT_TENANT_ID, name: cat.name, slug: cat.slug },
    });
  }
  console.log(`  ✓ ${CATEGORIES.length} categories`);

  // ─── Product Type: Car Tyre ────────────────────────────────────────────────
  const carTyreType = await prisma.productType.upsert({
    where: { name: 'Car Tyre' },
    update: {},
    create: { name: 'Car Tyre', isStockable: true },
  });

  for (const attrDef of CAR_TYRE_ATTRIBUTES) {
    const attr = await prisma.attribute.upsert({
      where: { productTypeId_code: { productTypeId: carTyreType.id, code: attrDef.code } },
      update: {},
      create: {
        productTypeId: carTyreType.id,
        code: attrDef.code,
        label: attrDef.label,
        datatype: attrDef.datatype,
        isRequired: attrDef.isRequired,
        isVariantDefining: attrDef.isVariantDefining,
        displayOrder: attrDef.displayOrder,
      },
    });

    for (let i = 0; i < attrDef.options.length; i++) {
      await prisma.attributeOption.upsert({
        where: { attributeId_value: { attributeId: attr.id, value: attrDef.options[i] } },
        update: {},
        create: { attributeId: attr.id, value: attrDef.options[i], displayOrder: i },
      });
    }
  }
  console.log(`  ✓ Product type "Car Tyre" with ${CAR_TYRE_ATTRIBUTES.length} attributes`);

  // ─── Default settings ──────────────────────────────────────────────────────
  for (const setting of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { tenantId_key: { tenantId: DEFAULT_TENANT_ID, key: setting.key } },
      update: {},
      create: { tenantId: DEFAULT_TENANT_ID, key: setting.key, value: setting.value },
    });
  }
  console.log(`  ✓ ${DEFAULT_SETTINGS.length} default settings`);

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
