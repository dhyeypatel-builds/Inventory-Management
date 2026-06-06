import { z } from 'zod';

const SKU_REGEX = /^[A-Z0-9-]{3,60}$/;

export const variantBodySchema = z.object({
  sku: z.string().regex(SKU_REGEX, 'SKU must be 3-60 uppercase letters, digits, or hyphens'),
  purchasePrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  taxRatePct: z.number().min(0).max(100).default(0),
  manufacturingDate: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  openingStock: z.number().int().min(0).default(0),
  rackLocation: z.string().optional().nullable(),
  reorderLevel: z.number().int().min(0).default(5),
});

export const createProductSchema = z.object({
  productTypeId: z.number().int().positive(),
  brandId: z.number().int().positive().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  name: z.string().min(1).max(160),
  description: z.string().optional().nullable(),
  warrantyMonths: z.number().int().min(0).optional().nullable(),
  variant: variantBodySchema.optional(),
});

export const updateProductSchema = z
  .object({
    brandId: z.number().int().positive().optional().nullable(),
    categoryId: z.number().int().positive().optional().nullable(),
    name: z.string().min(1).max(160).optional(),
    description: z.string().optional().nullable(),
    warrantyMonths: z.number().int().min(0).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export const updateVariantSchema = z
  .object({
    purchasePrice: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    taxRatePct: z.number().min(0).max(100).optional(),
    manufacturingDate: z.string().optional().nullable(),
    barcode: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export const productIdSchema = z.object({
  id: z.string().uuid(),
});

export const variantIdSchema = z.object({
  id: z.string().uuid(),
});

export const listProductsQuerySchema = z.object({
  q: z.string().optional(),
  brand: z.coerce.number().int().positive().optional(),
  type: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  includeInactive: z.string().optional().transform((v) => v === 'true'),
});

export const variantSearchQuerySchema = z.object({
  q: z.string().optional(),
  size: z.string().optional(),
  inStock: z.string().optional().transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type VariantBody = z.infer<typeof variantBodySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type VariantSearchQuery = z.infer<typeof variantSearchQuerySchema>;
