import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { currentTenant } from '../../tenancy/context';
import { NotFoundError } from '../../utils/errors';
import { sendWelcomeEmail } from '../../email';
import { createProduct } from '../products/products.service';
import { createCustomer } from '../customers/customers.service';

const DEMO_TAG = 'demo-seed';

/** Marks the current tenant's onboarding complete and sends the welcome email. */
export async function completeOnboarding(userId: string): Promise<{ onboardingCompletedAt: Date }> {
  const tenantId = currentTenant();
  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { onboardingCompletedAt: new Date() },
  });

  // Welcome the user who finished setup (fail-soft).
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    await sendWelcomeEmail({ to: user.email, shopName: tenant.name, appUrl: env.APP_URL });
  }

  return { onboardingCompletedAt: tenant.onboardingCompletedAt! };
}

// ─── Demo data (ON-03) ──────────────────────────────────────────────────────────

const DEMO_PRODUCTS = [
  { brand: 'Michelin', model: 'Primacy 4', size: '195/65 R15', type: 'Tubeless', buy: 62, sell: 99, qty: 24 },
  { brand: 'Bridgestone', model: 'Turanza T005', size: '205/55 R16', type: 'Tubeless', buy: 71, sell: 115, qty: 16 },
  { brand: 'Continental', model: 'PremiumContact 6', size: '195/65 R15', type: 'Radial', buy: 68, sell: 109, qty: 30 },
  { brand: 'Goodyear', model: 'EfficientGrip', size: '165/80 R14', type: 'Tubeless', buy: 48, sell: 79, qty: 6 },
  { brand: 'Pirelli', model: 'Cinturato P7', size: '205/55 R16', type: 'Tubeless', buy: 74, sell: 119, qty: 3 },
];

const DEMO_CUSTOMERS = [
  { name: 'Demo · Hayes Motors', phone: '07700 900123', vehicleNo: 'AB12 CDE' },
  { name: 'Demo · J. Okafor', phone: '07700 900456', vehicleNo: 'LM68 XYZ' },
];

export interface DemoSeedResult {
  seeded: boolean;
  products: number;
  customers: number;
}

/**
 * Populates the current tenant with sample tyres + customers so an evaluating
 * owner sees a live-looking app. Idempotent: re-running is a no-op. Demo rows are
 * tagged (product.description = 'demo-seed') so they can be cleared.
 */
export async function runDemoSeed(createdBy: string): Promise<DemoSeedResult> {
  const existing = await prisma.product.count({ where: { description: DEMO_TAG } });
  if (existing > 0) return { seeded: false, products: 0, customers: 0 };

  const productType = await prisma.productType.findFirst({ where: { name: 'Car Tyre' } });
  if (!productType) throw new NotFoundError('Car Tyre product type');

  const brands = await prisma.brand.findMany();
  const brandId = (name: string): number | undefined => brands.find((b) => b.name === name)?.id;

  let products = 0;
  for (const [i, p] of DEMO_PRODUCTS.entries()) {
    await createProduct(
      {
        productTypeId: productType.id,
        brandId: brandId(p.brand) ?? null,
        name: `${p.brand} ${p.model}`,
        description: DEMO_TAG,
        variant: {
          sku: `DEMO-${String(i + 1).padStart(3, '0')}`,
          purchasePrice: p.buy,
          sellingPrice: p.sell,
          taxRatePct: 20,
          attributes: { size: p.size, tyre_type: p.type },
          openingStock: p.qty,
          reorderLevel: 8,
        },
      },
      createdBy,
    );
    products += 1;
  }

  for (const c of DEMO_CUSTOMERS) {
    await createCustomer(c);
  }

  return { seeded: true, products, customers: DEMO_CUSTOMERS.length };
}

/** Soft-clears demo data (hides the tagged products + demo customers). */
export async function clearDemoSeed(): Promise<{ products: number; customers: number }> {
  const now = new Date();
  const [p, c] = await Promise.all([
    prisma.product.updateMany({ where: { description: DEMO_TAG, deletedAt: null }, data: { deletedAt: now } }),
    prisma.customer.updateMany({ where: { name: { startsWith: 'Demo · ' }, deletedAt: null }, data: { deletedAt: now } }),
  ]);
  return { products: p.count, customers: c.count };
}
