import { z } from 'zod';

// ─── GET /inventory ─────────────────────────────────────────────────────────
export const listInventoryQuerySchema = z.object({
  q: z.string().optional(),
  rack: z.string().optional(),
  lowStock: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  sort: z.enum(['name', 'qty']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

// ─── PATCH /inventory/:variantId ────────────────────────────────────────────
export const updateInventorySchema = z
  .object({
    reorderLevel: z.number().int().min(0).optional(),
    rackLocation: z.string().max(60).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

// ─── POST /inventory/:variantId/adjust ──────────────────────────────────────
export const adjustStockSchema = z.object({
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, { message: 'delta must be a non-zero integer' }),
  reason: z.string().min(1).max(200),
  note: z.string().max(500).optional().nullable(),
});

// ─── GET /inventory/:variantId/movements ────────────────────────────────────
export const movementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const variantIdParamSchema = z.object({
  variantId: z.string().uuid(),
});

export type ListInventoryQuery = z.infer<typeof listInventoryQuerySchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type MovementsQuery = z.infer<typeof movementsQuerySchema>;
