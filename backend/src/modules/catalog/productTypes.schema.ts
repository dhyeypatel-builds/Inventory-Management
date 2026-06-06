import { z } from 'zod';

export const productTypeIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listProductTypesQuerySchema = z.object({
  includeInactive: z.string().optional().transform((v) => v === 'true'),
});
