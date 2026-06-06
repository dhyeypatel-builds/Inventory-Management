import { z } from 'zod';

export const createBrandSchema = z.object({
  name: z.string().min(1).max(80),
  logoUrl: z.string().url().optional(),
});

export const updateBrandSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    logoUrl: z.string().url().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export const brandIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listBrandsQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  includeInactive: z.string().optional().transform((v) => v === 'true'),
});
