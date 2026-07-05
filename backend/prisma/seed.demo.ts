/**
 * Demo seed — populates realistic tyre-shop data on top of the master seed.
 * Run AFTER `npx prisma db seed` (master data must exist first).
 *
 * Usage:
 *   npx ts-node -e "require('./prisma/seed.demo.ts')"
 *   — or —
 *   DATABASE_URL=... npx ts-node prisma/seed.demo.ts
 */

import { PrismaClient, MovementType, AlertType, AlertStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 59), 0, 0);
  return d;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function nextSeq(existing: string[], year: number): string {
  const prefix = `INV-${year}-`;
  const nums = existing
    .filter((s) => s.startsWith(prefix))
    .map((s) => parseInt(s.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(6, '0')}`;
}

// ─── Customers ────────────────────────────────────────────────────────────────

const CUSTOMERS = [
  { name: 'Rajesh Kumar', phone: '+919876543210', email: 'rajesh.kumar@gmail.com', vehicleNo: 'GJ01AB1234', address: '12, Shyam Nagar, Ahmedabad' },
  { name: 'Priya Mehta', phone: '+919845012345', email: 'priya.mehta@outlook.com', vehicleNo: 'GJ05CD5678', address: '7, Vastrapur, Ahmedabad' },
  { name: 'Suresh Patel', phone: '+919712345678', vehicleNo: 'GJ01EF9012', address: '45, Maninagar, Ahmedabad' },
  { name: 'Anjali Singh', phone: '+919654321098', email: 'anjali.singh@yahoo.com', vehicleNo: 'GJ07GH3456', address: '3, Satellite Road, Ahmedabad' },
  { name: 'Vikram Shah', phone: '+919534567890', vehicleNo: 'GJ01IJ7890' },
  { name: 'Meena Desai', phone: '+919423456789', email: 'meena.d@gmail.com', vehicleNo: 'GJ06KL2345', address: '89, Navrangpura, Ahmedabad' },
  { name: 'Arun Nair', phone: '+919312345678', vehicleNo: 'KA03MN6789', address: 'Bengaluru, Karnataka' },
  { name: 'Kavita Joshi', phone: '+919201234567', email: 'kavita.joshi@gmail.com', vehicleNo: 'MH12OP1234' },
  { name: 'Deepak Rao', phone: '+919098765432', vehicleNo: 'GJ01QR5678', address: '22, Bopal, Ahmedabad' },
  { name: 'Sonal Trivedi', phone: '+918987654321', email: 'sonal.t@gmail.com', vehicleNo: 'GJ01ST9012', address: '67, Chandkheda, Ahmedabad' },
];

// ─── Products ─────────────────────────────────────────────────────────────────
// Each entry: product-level data + variants, each variant has attribute values + pricing + opening stock

interface VariantSpec {
  sku: string;
  size: string;
  tyreType: string;
  vehicleType?: string;
  position?: string;
  terrain?: string;
  pattern?: string;
  purchasePrice: number;
  sellingPrice: number;
  taxRatePct: number;
  openingStock: number;
  reorderLevel: number;
  rackLocation: string;
}

interface ProductSpec {
  name: string;
  brandName: string;
  categorySlug: string;
  warrantyMonths: number;
  variants: VariantSpec[];
}

const PRODUCTS: ProductSpec[] = [
  {
    name: 'MRF ZVTS',
    brandName: 'MRF',
    categorySlug: 'car',
    warrantyMonths: 60,
    variants: [
      { sku: 'MRF-ZVTS-195-65-R15-TL', size: '195/65 R15', tyreType: 'Tubeless', vehicleType: 'Sedan', position: 'Universal', terrain: 'City', pattern: 'ZVTS', purchasePrice: 3800, sellingPrice: 4800, taxRatePct: 18, openingStock: 12, reorderLevel: 4, rackLocation: 'A-01' },
      { sku: 'MRF-ZVTS-205-55-R16-TL', size: '205/55 R16', tyreType: 'Tubeless', vehicleType: 'Sedan', position: 'Universal', terrain: 'City', pattern: 'ZVTS', purchasePrice: 4500, sellingPrice: 5600, taxRatePct: 18, openingStock: 8, reorderLevel: 4, rackLocation: 'A-02' },
      { sku: 'MRF-ZVTS-165-80-R14-TL', size: '165/80 R14', tyreType: 'Tubeless', vehicleType: 'Hatchback', position: 'Universal', terrain: 'City', pattern: 'ZVTS', purchasePrice: 2900, sellingPrice: 3700, taxRatePct: 18, openingStock: 16, reorderLevel: 5, rackLocation: 'A-03' },
    ],
  },
  {
    name: 'MRF WANDERER',
    brandName: 'MRF',
    categorySlug: 'suv',
    warrantyMonths: 60,
    variants: [
      { sku: 'MRF-WAND-205-55-R16-TL', size: '205/55 R16', tyreType: 'Tubeless', vehicleType: 'SUV', position: 'Universal', terrain: 'Highway', pattern: 'Wanderer', purchasePrice: 5200, sellingPrice: 6500, taxRatePct: 18, openingStock: 6, reorderLevel: 3, rackLocation: 'A-04' },
    ],
  },
  {
    name: 'CEAT Milaze X3',
    brandName: 'CEAT',
    categorySlug: 'car',
    warrantyMonths: 48,
    variants: [
      { sku: 'CEAT-MX3-165-80-R14-TL', size: '165/80 R14', tyreType: 'Tubeless', vehicleType: 'Hatchback', position: 'Universal', terrain: 'City', pattern: 'Milaze X3', purchasePrice: 2600, sellingPrice: 3300, taxRatePct: 18, openingStock: 14, reorderLevel: 5, rackLocation: 'B-01' },
      { sku: 'CEAT-MX3-195-65-R15-TL', size: '195/65 R15', tyreType: 'Tubeless', vehicleType: 'Sedan', position: 'Universal', terrain: 'City', pattern: 'Milaze X3', purchasePrice: 3500, sellingPrice: 4400, taxRatePct: 18, openingStock: 10, reorderLevel: 4, rackLocation: 'B-02' },
    ],
  },
  {
    name: 'CEAT Crossdrive AT',
    brandName: 'CEAT',
    categorySlug: 'suv',
    warrantyMonths: 48,
    variants: [
      { sku: 'CEAT-CDAT-205-55-R16-TL', size: '205/55 R16', tyreType: 'Tubeless', vehicleType: 'SUV', position: 'Universal', terrain: 'All Terrain', pattern: 'Crossdrive AT', purchasePrice: 5800, sellingPrice: 7200, taxRatePct: 18, openingStock: 4, reorderLevel: 3, rackLocation: 'B-03' },
    ],
  },
  {
    name: 'Apollo Alnac 4G',
    brandName: 'Apollo Tyres',
    categorySlug: 'car',
    warrantyMonths: 60,
    variants: [
      { sku: 'APL-AL4G-165-80-R14-TL', size: '165/80 R14', tyreType: 'Tubeless', vehicleType: 'Hatchback', position: 'Universal', terrain: 'City', pattern: 'Alnac 4G', purchasePrice: 2700, sellingPrice: 3400, taxRatePct: 18, openingStock: 18, reorderLevel: 6, rackLocation: 'C-01' },
      { sku: 'APL-AL4G-195-65-R15-TL', size: '195/65 R15', tyreType: 'Tubeless', vehicleType: 'Sedan', position: 'Universal', terrain: 'City', pattern: 'Alnac 4G', purchasePrice: 3600, sellingPrice: 4500, taxRatePct: 18, openingStock: 10, reorderLevel: 4, rackLocation: 'C-02' },
      { sku: 'APL-AL4G-205-55-R16-TL', size: '205/55 R16', tyreType: 'Tubeless', vehicleType: 'Sedan', position: 'Universal', terrain: 'City', pattern: 'Alnac 4G', purchasePrice: 4400, sellingPrice: 5500, taxRatePct: 18, openingStock: 3, reorderLevel: 4, rackLocation: 'C-03' },
    ],
  },
  {
    name: 'Apollo Apterra AT2',
    brandName: 'Apollo Tyres',
    categorySlug: 'suv',
    warrantyMonths: 60,
    variants: [
      { sku: 'APL-AT2-205-55-R16-TL', size: '205/55 R16', tyreType: 'Tubeless', vehicleType: 'SUV', position: 'Universal', terrain: 'All Terrain', pattern: 'Apterra AT2', purchasePrice: 6200, sellingPrice: 7800, taxRatePct: 18, openingStock: 5, reorderLevel: 3, rackLocation: 'C-04' },
    ],
  },
  {
    name: 'Bridgestone Ecopia EP150',
    brandName: 'Bridgestone',
    categorySlug: 'car',
    warrantyMonths: 60,
    variants: [
      { sku: 'BRG-EP150-165-80-R14-TL', size: '165/80 R14', tyreType: 'Tubeless', vehicleType: 'Hatchback', position: 'Universal', terrain: 'Highway', pattern: 'Ecopia EP150', purchasePrice: 3100, sellingPrice: 3900, taxRatePct: 18, openingStock: 9, reorderLevel: 4, rackLocation: 'D-01' },
      { sku: 'BRG-EP150-195-65-R15-TL', size: '195/65 R15', tyreType: 'Tubeless', vehicleType: 'Sedan', position: 'Universal', terrain: 'Highway', pattern: 'Ecopia EP150', purchasePrice: 4100, sellingPrice: 5100, taxRatePct: 18, openingStock: 2, reorderLevel: 4, rackLocation: 'D-02' },
    ],
  },
  {
    name: 'Michelin Primacy 4',
    brandName: 'Michelin',
    categorySlug: 'car',
    warrantyMonths: 72,
    variants: [
      { sku: 'MCH-PR4-195-65-R15-TL', size: '195/65 R15', tyreType: 'Tubeless', vehicleType: 'Sedan', position: 'Universal', terrain: 'Highway', pattern: 'Primacy 4', purchasePrice: 5500, sellingPrice: 7000, taxRatePct: 18, openingStock: 6, reorderLevel: 3, rackLocation: 'E-01' },
      { sku: 'MCH-PR4-205-55-R16-TL', size: '205/55 R16', tyreType: 'Tubeless', vehicleType: 'Sedan', position: 'Universal', terrain: 'Highway', pattern: 'Primacy 4', purchasePrice: 6800, sellingPrice: 8500, taxRatePct: 18, openingStock: 4, reorderLevel: 3, rackLocation: 'E-02' },
    ],
  },
  {
    name: 'Goodyear Assurance TripleMax 2',
    brandName: 'Goodyear',
    categorySlug: 'car',
    warrantyMonths: 60,
    variants: [
      { sku: 'GY-ATM2-165-80-R14-TL', size: '165/80 R14', tyreType: 'Tubeless', vehicleType: 'Hatchback', position: 'Universal', terrain: 'City', pattern: 'Assurance TripleMax 2', purchasePrice: 2900, sellingPrice: 3650, taxRatePct: 18, openingStock: 11, reorderLevel: 4, rackLocation: 'F-01' },
      { sku: 'GY-ATM2-195-65-R15-TL', size: '195/65 R15', tyreType: 'Tubeless', vehicleType: 'Sedan', position: 'Universal', terrain: 'City', pattern: 'Assurance TripleMax 2', purchasePrice: 3700, sellingPrice: 4650, taxRatePct: 18, openingStock: 0, reorderLevel: 4, rackLocation: 'F-02' },
    ],
  },
  {
    name: 'MRF ZLX',
    brandName: 'MRF',
    categorySlug: 'car',
    warrantyMonths: 60,
    variants: [
      { sku: 'MRF-ZLX-145-80-R12-TT', size: '145/80 R12', tyreType: 'Tube Type', vehicleType: 'Hatchback', position: 'Universal', terrain: 'City', pattern: 'ZLX', purchasePrice: 1800, sellingPrice: 2300, taxRatePct: 18, openingStock: 20, reorderLevel: 6, rackLocation: 'A-05' },
    ],
  },
];

// ─── Sale templates (variant SKU + qty + optional discount) ───────────────────

interface SaleLine {
  sku: string;
  qty: number;
  discount?: number;
}

interface SaleTemplate {
  customerIndex: number; // index into CUSTOMERS
  paymentMode: 'CASH' | 'CARD' | 'UPI';
  daysAgoN: number;
  lines: SaleLine[];
}

const SALE_TEMPLATES: SaleTemplate[] = [
  { customerIndex: 0, paymentMode: 'CASH', daysAgoN: 30, lines: [{ sku: 'MRF-ZVTS-195-65-R15-TL', qty: 4 }] },
  { customerIndex: 1, paymentMode: 'UPI', daysAgoN: 29, lines: [{ sku: 'CEAT-MX3-165-80-R14-TL', qty: 2 }, { sku: 'APL-AL4G-165-80-R14-TL', qty: 2 }] },
  { customerIndex: 2, paymentMode: 'CARD', daysAgoN: 28, lines: [{ sku: 'APL-AL4G-195-65-R15-TL', qty: 4, discount: 500 }] },
  { customerIndex: 3, paymentMode: 'CASH', daysAgoN: 27, lines: [{ sku: 'BRG-EP150-165-80-R14-TL', qty: 2 }] },
  { customerIndex: 4, paymentMode: 'UPI', daysAgoN: 25, lines: [{ sku: 'MRF-ZLX-145-80-R12-TT', qty: 4 }] },
  { customerIndex: 5, paymentMode: 'CASH', daysAgoN: 24, lines: [{ sku: 'MCH-PR4-195-65-R15-TL', qty: 4, discount: 1000 }] },
  { customerIndex: 6, paymentMode: 'CARD', daysAgoN: 22, lines: [{ sku: 'CEAT-CDAT-205-55-R16-TL', qty: 2 }] },
  { customerIndex: 7, paymentMode: 'UPI', daysAgoN: 21, lines: [{ sku: 'APL-AT2-205-55-R16-TL', qty: 4 }] },
  { customerIndex: 8, paymentMode: 'CASH', daysAgoN: 20, lines: [{ sku: 'MRF-ZVTS-165-80-R14-TL', qty: 4 }] },
  { customerIndex: 9, paymentMode: 'CASH', daysAgoN: 18, lines: [{ sku: 'GY-ATM2-165-80-R14-TL', qty: 2 }, { sku: 'CEAT-MX3-165-80-R14-TL', qty: 2 }] },
  { customerIndex: 0, paymentMode: 'UPI', daysAgoN: 17, lines: [{ sku: 'BRG-EP150-195-65-R15-TL', qty: 2 }] },
  { customerIndex: 1, paymentMode: 'CARD', daysAgoN: 15, lines: [{ sku: 'MCH-PR4-205-55-R16-TL', qty: 2, discount: 500 }] },
  { customerIndex: 2, paymentMode: 'CASH', daysAgoN: 14, lines: [{ sku: 'MRF-WAND-205-55-R16-TL', qty: 4, discount: 800 }] },
  { customerIndex: 3, paymentMode: 'UPI', daysAgoN: 12, lines: [{ sku: 'APL-AL4G-205-55-R16-TL', qty: 2 }] },
  { customerIndex: 4, paymentMode: 'CASH', daysAgoN: 11, lines: [{ sku: 'MRF-ZLX-145-80-R12-TT', qty: 4 }] },
  { customerIndex: 5, paymentMode: 'CARD', daysAgoN: 10, lines: [{ sku: 'CEAT-MX3-195-65-R15-TL', qty: 4 }] },
  { customerIndex: 6, paymentMode: 'UPI', daysAgoN: 8, lines: [{ sku: 'MRF-ZVTS-205-55-R16-TL', qty: 2 }, { sku: 'APL-AL4G-165-80-R14-TL', qty: 2 }] },
  { customerIndex: 7, paymentMode: 'CASH', daysAgoN: 7, lines: [{ sku: 'GY-ATM2-165-80-R14-TL', qty: 4 }] },
  { customerIndex: 8, paymentMode: 'UPI', daysAgoN: 5, lines: [{ sku: 'APL-AL4G-195-65-R15-TL', qty: 2 }] },
  { customerIndex: 9, paymentMode: 'CARD', daysAgoN: 4, lines: [{ sku: 'MCH-PR4-195-65-R15-TL', qty: 2 }] },
  { customerIndex: 0, paymentMode: 'CASH', daysAgoN: 3, lines: [{ sku: 'CEAT-CDAT-205-55-R16-TL', qty: 2 }] },
  { customerIndex: 1, paymentMode: 'UPI', daysAgoN: 2, lines: [{ sku: 'BRG-EP150-165-80-R14-TL', qty: 4 }] },
  { customerIndex: 2, paymentMode: 'CASH', daysAgoN: 1, lines: [{ sku: 'MRF-ZVTS-195-65-R15-TL', qty: 2 }, { sku: 'MRF-ZVTS-165-80-R14-TL', qty: 2 }] },
  { customerIndex: 3, paymentMode: 'CARD', daysAgoN: 0, lines: [{ sku: 'APL-AL4G-165-80-R14-TL', qty: 4 }] },
  { customerIndex: 4, paymentMode: 'UPI', daysAgoN: 0, lines: [{ sku: 'MRF-ZLX-145-80-R12-TT', qty: 2 }] },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🌱 Starting demo seed...');

  // ── Resolve master data ────────────────────────────────────────────────────
  const adminUser = await prisma.user.findFirst({ where: { role: { name: 'ADMIN' } } });
  if (!adminUser) throw new Error('No ADMIN user found — run `npx prisma db seed` first.');

  const brands = await prisma.brand.findMany();
  const brandMap = new Map(brands.map((b) => [b.name, b.id]));

  const categories = await prisma.category.findMany();
  const catMap = new Map(categories.map((c) => [c.slug, c.id]));

  const carTyreType = await prisma.productType.findUnique({ where: { name: 'Tyre' } });
  if (!carTyreType) throw new Error('Product type "Tyre" not found — run master seed first.');

  const attributes = await prisma.attribute.findMany({
    where: { productTypeId: carTyreType.id },
    include: { options: true },
  });
  const attrByCode = new Map(attributes.map((a) => [a.code, a]));

  function optionId(attrCode: string, value: string): number {
    const attr = attrByCode.get(attrCode);
    if (!attr) throw new Error(`Attribute not found: ${attrCode}`);
    const opt = attr.options.find((o) => o.value === value);
    if (!opt) throw new Error(`Option "${value}" not found on attribute "${attrCode}"`);
    return opt.id;
  }

  // ── Customers ──────────────────────────────────────────────────────────────
  const customerIds: string[] = [];
  for (const c of CUSTOMERS) {
    const existing = await prisma.customer.findFirst({ where: { phone: c.phone } });
    if (existing) {
      customerIds.push(existing.id);
      continue;
    }
    const created = await prisma.customer.create({ data: c });
    customerIds.push(created.id);
  }
  console.log(`  ✓ ${CUSTOMERS.length} customers`);

  // ── Products + variants ────────────────────────────────────────────────────
  const variantMap = new Map<string, { id: string; sellingPrice: number; taxRatePct: number; name: string }>();

  for (const spec of PRODUCTS) {
    const brandId = brandMap.get(spec.brandName);
    if (!brandId) throw new Error(`Brand not found: ${spec.brandName}`);
    const categoryId = catMap.get(spec.categorySlug);
    if (!categoryId) throw new Error(`Category not found: ${spec.categorySlug}`);

    // Create product (skip if SKU of first variant already exists)
    const firstSku = spec.variants[0].sku;
    const existingVariant = await prisma.productVariant.findUnique({ where: { sku: firstSku } });
    let productId: string;

    if (existingVariant) {
      productId = existingVariant.productId;
    } else {
      const product = await prisma.product.create({
        data: {
          name: spec.name,
          productTypeId: carTyreType.id,
          brandId,
          categoryId,
          warrantyMonths: spec.warrantyMonths,
        },
      });
      productId = product.id;
    }

    for (const v of spec.variants) {
      const existingV = await prisma.productVariant.findUnique({ where: { sku: v.sku } });
      let variantId: string;

      if (existingV) {
        variantId = existingV.id;
      } else {
        const variant = await prisma.$transaction(async (tx) => {
          const created = await tx.productVariant.create({
            data: {
              productId,
              sku: v.sku,
              purchasePrice: v.purchasePrice,
              sellingPrice: v.sellingPrice,
              taxRatePct: v.taxRatePct,
            },
          });

          // EAV attribute values
          const attrValues: { variantId: string; attributeId: number; optionId?: number; valueText?: string }[] = [];

          const sizeAttr = attrByCode.get('size')!;
          attrValues.push({ variantId: created.id, attributeId: sizeAttr.id, optionId: optionId('size', v.size) });

          const tyreTypeAttr = attrByCode.get('tyre_type')!;
          attrValues.push({ variantId: created.id, attributeId: tyreTypeAttr.id, optionId: optionId('tyre_type', v.tyreType) });

          if (v.position) {
            const attr = attrByCode.get('position')!;
            attrValues.push({ variantId: created.id, attributeId: attr.id, optionId: optionId('position', v.position) });
          }
          if (v.terrain) {
            const attr = attrByCode.get('terrain')!;
            attrValues.push({ variantId: created.id, attributeId: attr.id, optionId: optionId('terrain', v.terrain) });
          }
          if (v.pattern) {
            const attr = attrByCode.get('pattern')!;
            attrValues.push({ variantId: created.id, attributeId: attr.id, valueText: v.pattern });
          }

          await tx.variantAttributeValue.createMany({ data: attrValues });

          // Inventory row + OPENING movement
          await tx.inventory.create({
            data: {
              variantId: created.id,
              quantity: v.openingStock,
              reorderLevel: v.reorderLevel,
              rackLocation: v.rackLocation,
            },
          });

          await tx.stockMovement.create({
            data: {
              variantId: created.id,
              type: MovementType.OPENING,
              quantityDelta: v.openingStock,
              balanceAfter: v.openingStock,
              referenceType: 'OPENING',
              note: 'Demo opening stock',
              createdBy: adminUser.id,
            },
          });

          return created;
        });
        variantId = variant.id;
      }

      variantMap.set(v.sku, {
        id: variantId,
        sellingPrice: v.sellingPrice,
        taxRatePct: v.taxRatePct,
        name: `${spec.name} ${v.size}`,
      });
    }
  }
  console.log(`  ✓ ${PRODUCTS.length} products, ${variantMap.size} variants`);

  // ── Sales ──────────────────────────────────────────────────────────────────
  const year = new Date().getFullYear();
  const existingInvoices = (await prisma.sale.findMany({ select: { invoiceNo: true } })).map((s) => s.invoiceNo);
  const usedInvoices: string[] = [...existingInvoices];
  let salesCreated = 0;

  for (const tmpl of SALE_TEMPLATES) {
    // Check if this customer already has a sale on that day (idempotency for re-runs)
    const soldAt = daysAgo(tmpl.daysAgoN);
    const startOfDay = new Date(soldAt);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(soldAt);
    endOfDay.setHours(23, 59, 59, 999);

    const customerId = customerIds[tmpl.customerIndex];

    // Build lines — check variant exists
    const lines: Array<{ variantId: string; description: string; qty: number; unitPrice: number; taxRatePct: number; discount: number }> = [];
    let skipSale = false;

    for (const line of tmpl.lines) {
      const v = variantMap.get(line.sku);
      if (!v) { console.warn(`  ⚠ SKU not found: ${line.sku}, skipping sale`); skipSale = true; break; }

      // Check inventory is sufficient
      const inv = await prisma.inventory.findUnique({ where: { variantId: v.id } });
      if (!inv || inv.quantity < line.qty) {
        // Not enough stock — skip this sale (stock was consumed by earlier sales in sequence)
        skipSale = true;
        break;
      }

      lines.push({
        variantId: v.id,
        description: v.name,
        qty: line.qty,
        unitPrice: v.sellingPrice,
        taxRatePct: v.taxRatePct,
        discount: line.discount ?? 0,
      });
    }

    if (skipSale) continue;

    // Compute totals
    let subtotal = 0;
    let totalDiscount = 0;
    let taxTotal = 0;
    const itemData: Array<{ variantId: string; description: string; quantity: number; unitPrice: number; discount: number; taxRatePct: number; lineTotal: number }> = [];

    for (const line of lines) {
      const lineBase = round2(line.unitPrice * line.qty);
      const taxable = round2(lineBase - line.discount);
      const lineTax = round2((taxable * line.taxRatePct) / 100);
      const lineTotal = round2(taxable + lineTax);
      subtotal += lineBase;
      totalDiscount += line.discount;
      taxTotal += lineTax;
      itemData.push({
        variantId: line.variantId,
        description: line.description,
        quantity: line.qty,
        unitPrice: line.unitPrice,
        discount: line.discount,
        taxRatePct: line.taxRatePct,
        lineTotal,
      });
    }
    subtotal = round2(subtotal);
    totalDiscount = round2(totalDiscount);
    taxTotal = round2(taxTotal);
    const grandTotal = round2(subtotal - totalDiscount + taxTotal);

    const invoiceNo = nextSeq(usedInvoices, year);
    usedInvoices.push(invoiceNo);

    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          invoiceNo,
          customerId,
          status: 'CONFIRMED',
          paymentMode: tmpl.paymentMode,
          subtotal,
          discount: totalDiscount,
          taxTotal,
          grandTotal,
          soldAt,
          createdBy: adminUser.id,
        },
      });

      await tx.saleItem.createMany({
        data: itemData.map((item) => ({
          saleId: sale.id,
          variantId: item.variantId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRatePct: item.taxRatePct,
          lineTotal: item.lineTotal,
        })),
      });

      // Decrement inventory + SALE movements
      for (const item of itemData) {
        const inv = await tx.inventory.findUnique({ where: { variantId: item.variantId } });
        const balanceAfter = (inv?.quantity ?? 0) - item.quantity;
        await tx.inventory.update({
          where: { variantId: item.variantId },
          data: { quantity: balanceAfter },
        });
        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: MovementType.SALE,
            quantityDelta: -item.quantity,
            balanceAfter,
            referenceType: 'Sale',
            referenceId: sale.id,
            note: `Sale ${invoiceNo}`,
            createdAt: soldAt,
            createdBy: adminUser.id,
          },
        });
      }
    });

    salesCreated++;
  }
  console.log(`  ✓ ${salesCreated} sales created`);

  // ── Alert evaluation ───────────────────────────────────────────────────────
  const allVariantIds = [...variantMap.values()].map((v) => v.id);
  for (const variantId of allVariantIds) {
    const inv = await prisma.inventory.findUnique({ where: { variantId } });
    if (!inv) continue;
    const qty = inv.quantity;
    const threshold = inv.reorderLevel;

    let desiredType: AlertType | null = null;
    if (qty <= 0) desiredType = AlertType.OUT_OF_STOCK;
    else if (qty <= threshold) desiredType = AlertType.LOW_STOCK;

    if (!desiredType) continue;

    const existing = await prisma.alert.findFirst({
      where: { variantId, type: desiredType, status: AlertStatus.OPEN },
    });
    if (existing) continue;

    const message =
      desiredType === AlertType.OUT_OF_STOCK
        ? 'Out of stock'
        : `Low stock: ${qty} remaining (reorder level ${threshold})`;

    await prisma.alert.create({
      data: { variantId, type: desiredType, status: AlertStatus.OPEN, message, currentQty: qty, threshold },
    });
  }
  console.log('  ✓ Stock alerts evaluated');

  // ── Summary ────────────────────────────────────────────────────────────────
  const [customerCount, productCount, variantCount, saleCount, alertCount] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.productVariant.count({ where: { deletedAt: null } }),
    prisma.sale.count({ where: { status: 'CONFIRMED' } }),
    prisma.alert.count({ where: { status: AlertStatus.OPEN } }),
  ]);

  console.log('\n✅ Demo seed complete');
  console.log(`   Customers : ${customerCount}`);
  console.log(`   Products  : ${productCount}`);
  console.log(`   Variants  : ${variantCount}`);
  console.log(`   Sales     : ${saleCount}`);
  console.log(`   Open alerts: ${alertCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Demo seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
