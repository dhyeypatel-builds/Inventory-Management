import { Prisma } from '@prisma/client';
import { prisma, type TxClient } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { parsePagination, buildMeta } from '../../utils/pagination';
import type { VariantBody, CreateProductInput, ListProductsQuery, VariantSearchQuery } from './products.schema';

// ─── Attribute validation ─────────────────────────────────────────────────────

type AttrValueCreate = {
  attributeId: number;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: Date | null;
  valueBool?: boolean | null;
  optionId?: number | null;
};

async function validateAttributes(
  productTypeId: number,
  attributes: Record<string, string | number | boolean>,
): Promise<AttrValueCreate[]> {
  const attrDefs = await prisma.attribute.findMany({
    where: { productTypeId },
    include: { options: true },
  });

  const byCode = new Map(attrDefs.map((a) => [a.code, a]));
  const errors: string[] = [];

  // Required-attribute check first so caller gets a clear message
  for (const a of attrDefs) {
    if (a.isRequired && !(a.code in attributes)) {
      errors.push(`Required attribute "${a.label}" (${a.code}) is missing`);
    }
  }
  if (errors.length) throw new ValidationError('Missing required attributes', errors);

  const values: AttrValueCreate[] = [];

  for (const [code, raw] of Object.entries(attributes)) {
    const attr = byCode.get(code);
    if (!attr) {
      errors.push(`Unknown attribute code: "${code}"`);
      continue;
    }

    const v: AttrValueCreate = { attributeId: attr.id };

    switch (attr.datatype) {
      case 'ENUM': {
        const opt = attr.options.find((o) => o.value === String(raw));
        if (!opt) {
          errors.push(
            `Attribute "${attr.label}" has invalid value "${raw}". Allowed: ${attr.options.map((o) => o.value).join(', ')}`,
          );
          break;
        }
        v.valueText = String(raw);
        v.optionId = opt.id;
        break;
      }
      case 'TEXT':
        v.valueText = String(raw);
        break;
      case 'NUMBER':
        if (typeof raw !== 'number') {
          errors.push(`Attribute "${attr.label}" must be a number`);
          break;
        }
        v.valueNumber = raw;
        break;
      case 'BOOLEAN':
        v.valueBool = Boolean(raw);
        break;
      case 'DATE':
        v.valueDate = new Date(String(raw));
        break;
    }

    values.push(v);
  }

  if (errors.length) throw new ValidationError('Invalid attribute values', errors);
  return values;
}

// ─── EAV resolver: raw DB rows → { code: value } map ─────────────────────────

function resolveAttrs(
  rows: Array<{
    attribute: { code: string; datatype: string };
    valueText: string | null;
    valueNumber: Prisma.Decimal | null;
    valueBool: boolean | null;
    valueDate: Date | null;
  }>,
): Record<string, unknown> {
  return Object.fromEntries(
    rows.map(({ attribute: { code, datatype }, valueText, valueNumber, valueBool, valueDate }) => {
      switch (datatype) {
        case 'TEXT':
        case 'ENUM':
          return [code, valueText];
        case 'NUMBER':
          return [code, valueNumber !== null ? Number(valueNumber) : null];
        case 'BOOLEAN':
          return [code, valueBool];
        case 'DATE':
          return [code, valueDate ? valueDate.toISOString() : null];
        default:
          return [code, null];
      }
    }),
  );
}

// ─── Shared Prisma include for variant detail ─────────────────────────────────

const variantDetail = {
  attributeValues: {
    include: { attribute: { select: { code: true, label: true, datatype: true } } },
  },
  inventory: {
    select: { quantity: true, reorderLevel: true, rackLocation: true, updatedAt: true },
  },
} as const;

// ─── Format helpers ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatVariant(v: any) {
  const { attributeValues, ...rest } = v;
  return { ...rest, attributeValues: resolveAttrs(attributeValues) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatProduct(p: any) {
  const { variants, ...rest } = p;
  return {
    ...rest,
    variants: variants ? (variants as unknown[]).map(formatVariant) : undefined,
  };
}

// ─── Variant creation (reused by createProduct and addVariant) ────────────────

async function createVariantInTx(
  tx: TxClient,
  productId: string,
  variantData: VariantBody,
  attrValues: AttrValueCreate[],
  createdBy: string | null,
) {
  const variant = await tx.productVariant.create({
    data: {
      productId,
      sku: variantData.sku,
      purchasePrice: variantData.purchasePrice,
      sellingPrice: variantData.sellingPrice,
      taxRatePct: variantData.taxRatePct,
      manufacturingDate: variantData.manufacturingDate
        ? new Date(variantData.manufacturingDate)
        : null,
      barcode: variantData.barcode ?? null,
    },
  });

  if (attrValues.length > 0) {
    await tx.variantAttributeValue.createMany({
      data: attrValues.map((v) => ({ variantId: variant.id, ...v })),
    });
  }

  await tx.inventory.create({
    data: {
      variantId: variant.id,
      quantity: variantData.openingStock,
      reorderLevel: variantData.reorderLevel,
      rackLocation: variantData.rackLocation ?? null,
    },
  });

  if (variantData.openingStock > 0) {
    await tx.stockMovement.create({
      data: {
        variantId: variant.id,
        type: 'OPENING',
        quantityDelta: variantData.openingStock,
        balanceAfter: variantData.openingStock,
        note: 'Opening stock',
        createdBy,
      },
    });
  }

  return variant.id;
}

// ─── Service functions ────────────────────────────────────────────────────────

export const createProduct = async (data: CreateProductInput, createdBy?: string) => {
  // Validate product type exists
  const productType = await prisma.productType.findFirst({
    where: { id: data.productTypeId, isActive: true },
  });
  if (!productType) throw new NotFoundError('Product type');

  // Validate optional FKs
  if (data.brandId) {
    const brand = await prisma.brand.findFirst({ where: { id: data.brandId, deletedAt: null } });
    if (!brand) throw new NotFoundError('Brand');
  }
  if (data.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: data.categoryId, deletedAt: null } });
    if (!cat) throw new NotFoundError('Category');
  }

  // Validate variant before entering the transaction
  let attrValues: AttrValueCreate[] = [];
  if (data.variant) {
    const existing = await prisma.productVariant.findFirst({ where: { sku: data.variant.sku } });
    if (existing) throw new ConflictError(`SKU "${data.variant.sku}" is already in use`);
    attrValues = await validateAttributes(data.productTypeId, data.variant.attributes);
  }

  try {
    const productId = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          productTypeId: data.productTypeId,
          brandId: data.brandId ?? null,
          categoryId: data.categoryId ?? null,
          name: data.name,
          description: data.description ?? null,
          warrantyMonths: data.warrantyMonths ?? null,
        },
      });

      if (data.variant) {
        await createVariantInTx(tx, product.id, data.variant, attrValues, createdBy ?? null);
      }

      return product.id;
    });

    // Return full detail (with resolved attribute values)
    return getProduct(productId);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('A record with that unique value already exists');
    }
    throw err;
  }
};

export const getProduct = async (id: string) => {
  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, slug: true } },
      productType: { select: { id: true, name: true } },
      variants: {
        where: { deletedAt: null },
        include: variantDetail,
      },
    },
  });

  if (!product) throw new NotFoundError('Product');
  return formatProduct(product);
};

export const listProducts = async (query: ListProductsQuery) => {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(query.includeInactive ? {} : { isActive: true }),
    ...(query.brand ? { brandId: query.brand } : {}),
    ...(query.type ? { productTypeId: query.type } : {}),
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
      include: {
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        productType: { select: { id: true, name: true } },
        _count: { select: { variants: { where: { deletedAt: null, isActive: true } } } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { products, meta: buildMeta(page, pageSize, total) };
};

export const updateProduct = async (
  id: string,
  data: {
    brandId?: number | null;
    categoryId?: number | null;
    name?: string;
    description?: string | null;
    warrantyMonths?: number | null;
    isActive?: boolean;
  },
) => {
  const product = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!product) throw new NotFoundError('Product');

  if (data.brandId) {
    const brand = await prisma.brand.findFirst({ where: { id: data.brandId, deletedAt: null } });
    if (!brand) throw new NotFoundError('Brand');
  }
  if (data.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: data.categoryId, deletedAt: null } });
    if (!cat) throw new NotFoundError('Category');
  }

  return prisma.product.update({
    where: { id },
    data,
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      productType: { select: { id: true, name: true } },
    },
  });
};

export const deleteProduct = async (id: string) => {
  const product = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!product) throw new NotFoundError('Product');

  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
};

export const addVariant = async (
  productId: string,
  variantData: VariantBody,
  createdBy?: string,
) => {
  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!product) throw new NotFoundError('Product');

  const existing = await prisma.productVariant.findFirst({ where: { sku: variantData.sku } });
  if (existing) throw new ConflictError(`SKU "${variantData.sku}" is already in use`);

  const attrValues = await validateAttributes(product.productTypeId, variantData.attributes);

  try {
    const variantId = await prisma.$transaction(async (tx) =>
      createVariantInTx(tx, productId, variantData, attrValues, createdBy ?? null),
    );

    // Return full variant with resolved attribute values
    return prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      include: variantDetail,
    }).then(formatVariant);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('A record with that unique value already exists');
    }
    throw err;
  }
};

export const updateVariant = async (
  variantId: string,
  data: {
    purchasePrice?: number;
    sellingPrice?: number;
    taxRatePct?: number;
    manufacturingDate?: string | null;
    barcode?: string | null;
    isActive?: boolean;
  },
) => {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, deletedAt: null },
  });
  if (!variant) throw new NotFoundError('Variant');

  return prisma.productVariant.update({
    where: { id: variantId },
    data: {
      ...data,
      ...(data.manufacturingDate !== undefined
        ? { manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : null }
        : {}),
    },
  });
};

export const searchVariants = async (query: VariantSearchQuery) => {
  const { page, pageSize, skip, take } = parsePagination(query);

  const productFilter: Prisma.ProductWhereInput = {
    deletedAt: null,
    isActive: true,
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
  };

  const where: Prisma.ProductVariantWhereInput = {
    deletedAt: null,
    isActive: true,
    product: productFilter,
    ...(query.size
      ? {
          attributeValues: {
            some: { attribute: { code: 'size' }, valueText: query.size },
          },
        }
      : {}),
    ...(query.inStock ? { inventory: { quantity: { gt: 0 } } } : {}),
  };

  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { include: { brand: { select: { id: true, name: true } } } },
        inventory: { select: { quantity: true } },
        attributeValues: {
          include: { attribute: { select: { code: true, datatype: true } } },
        },
      },
    }),
    prisma.productVariant.count({ where }),
  ]);

  const data = variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    productId: v.productId,
    productName: v.product.name,
    brandName: v.product.brand?.name ?? null,
    purchasePrice: Number(v.purchasePrice),
    sellingPrice: Number(v.sellingPrice),
    taxRatePct: Number(v.taxRatePct),
    manufacturingDate: v.manufacturingDate,
    barcode: v.barcode,
    onHand: v.inventory?.quantity ?? 0,
    attributeValues: resolveAttrs(v.attributeValues),
  }));

  return { variants: data, meta: buildMeta(page, pageSize, total) };
};
