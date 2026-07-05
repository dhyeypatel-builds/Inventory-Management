import { z } from 'zod';

// Settings are stored as keyed JSON rows (e.g. `company.name`, `tax.default_pct`)
// but exposed/accepted as a nested object grouped by the key prefix.
export const updateSettingsSchema = z
  .object({
    company: z
      .object({
        name: z.string().min(1).max(160).optional(),
        phone: z.string().max(20).optional(),
        email: z.string().email().max(160).or(z.literal('')).optional(),
        address: z.string().max(500).optional(),
        vat_number: z.string().max(20).optional(),
        logo_url: z.string().max(500).optional(),
      })
      .strict()
      .optional(),
    tax: z
      .object({
        default_pct: z.number().min(0).max(100).optional(),
        // Whether the shop is registered for VAT. When false, sales charge no
        // VAT and invoices are titled "INVOICE" rather than "TAX INVOICE".
        vat_registered: z.boolean().optional(),
      })
      .strict()
      .optional(),
    inventory: z
      .object({
        default_reorder_level: z.number().int().min(0).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'No settings to update' });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
