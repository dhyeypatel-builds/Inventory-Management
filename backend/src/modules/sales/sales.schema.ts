import { z } from 'zod';

export const PAYMENT_MODES = ['CASH', 'CARD', 'BANK_TRANSFER'] as const;

const saleItemSchema = z
  .object({
    variantId: z.string().uuid(),
    quantity: z.number().int().positive(),
    // Optional price override; defaults to the variant's selling price (snapshot).
    unitPrice: z.number().min(0).optional(),
    // Per-line discount in currency units; validated against the line base server-side.
    discount: z.number().min(0).default(0),
    // Optional per-unit serial numbers being sold (warranty tracing).
    serials: z.array(z.string().trim().min(1).max(60)).max(500).default([]),
  })
  .refine((item) => item.serials.length <= item.quantity, {
    message: 'More serial numbers than units sold',
    path: ['serials'],
  });

export const createSaleSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  // Walk-in buyer (no saved Customer): name shown on the invoice, email used to
  // send it. Ignored when customerId is set (the linked customer is snapshotted).
  customerName: z.string().trim().min(1).max(120).optional().nullable(),
  customerEmail: z.string().email().optional().nullable(),
  paymentMode: z.enum(PAYMENT_MODES),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
});

// Email an existing sale's invoice (PDF) to an address.
export const emailInvoiceSchema = z.object({
  email: z.string().email(),
});

export const saleIdSchema = z.object({
  id: z.string().uuid(),
});

export const listSalesQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const returnSaleSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;
export type ReturnSaleInput = z.infer<typeof returnSaleSchema>;
export type EmailInvoiceInput = z.infer<typeof emailInvoiceSchema>;
