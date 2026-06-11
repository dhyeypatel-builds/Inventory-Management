import { z } from 'zod';

// ─── Vendors ─────────────────────────────────────────────────────────────────

export const createVendorSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
  vatNumber: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateVendorSchema = createVendorSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'Provide at least one field to update' },
);

export const listVendorsQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const vendorIdSchema = z.object({
  id: z.string().uuid(),
});

// ─── Purchases ───────────────────────────────────────────────────────────────

const purchaseItemSchema = z
  .object({
    variantId: z.string().uuid(),
    quantity: z.number().int().positive(),
    unitCost: z.number().min(0),
    taxRatePct: z.number().min(0).max(100).default(0),
    // Per-unit serial numbers (optional; at most one per unit received)
    serials: z.array(z.string().trim().min(1).max(60)).max(500).default([]),
  })
  .refine((item) => item.serials.length <= item.quantity, {
    message: 'More serial numbers than units received',
    path: ['serials'],
  });

export const createPurchaseSchema = z
  .object({
    vendorId: z.string().uuid().optional(),
    // When no vendorId is given, the vendor is found-or-created by name
    vendorName: z.string().trim().min(1).max(120).optional(),
    invoiceNo: z.string().trim().min(1).max(60),
    invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
    notes: z.string().max(1000).optional().nullable(),
    items: z.array(purchaseItemSchema).min(1, 'At least one item is required').max(200),
  })
  .refine((d) => d.vendorId || d.vendorName, {
    message: 'A vendor is required (vendorId or vendorName)',
    path: ['vendorName'],
  });

export const purchaseIdSchema = z.object({
  id: z.string().uuid(),
});

export const listPurchasesQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  q: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

// ─── Serial numbers ──────────────────────────────────────────────────────────

export const serialNoParamSchema = z.object({
  serialNo: z.string().trim().min(1).max(60),
});

// Manual transitions only — SOLD is owned by the sales flow
export const updateSerialSchema = z.object({
  status: z.enum(['IN_STOCK', 'RETURNED', 'DOA']),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type ListVendorsQuery = z.infer<typeof listVendorsQuerySchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type ListPurchasesQuery = z.infer<typeof listPurchasesQuerySchema>;
export type UpdateSerialInput = z.infer<typeof updateSerialSchema>;
