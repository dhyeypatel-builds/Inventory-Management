import { z } from 'zod';

export const slugify = (str: string): string =>
  str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

export const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(100).optional(),
  parentId: z.number().int().positive().optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    slug: z.string().min(1).max(100).optional(),
    parentId: z.number().int().positive().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export const categoryIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listCategoriesQuerySchema = z.object({
  includeInactive: z.string().optional().transform((v) => v === 'true'),
});
