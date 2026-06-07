import { z } from 'zod';

export const provisionTenantSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers, and hyphens only'),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(120),
});

export const tenantIdSchema = z.object({ id: z.string().uuid() });

export const listTenantsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  q: z.string().optional(),
});

export type ProvisionTenantInput = z.infer<typeof provisionTenantSchema>;
