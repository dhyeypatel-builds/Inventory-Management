import { z } from 'zod';

// ─── GET /alerts ──────────────────────────────────────────────────────────────
export const listAlertsQuerySchema = z.object({
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
  type: z.enum(['LOW_STOCK', 'OUT_OF_STOCK']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

// ─── POST /alerts/:id/acknowledge ───────────────────────────────────────────
export const alertIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
