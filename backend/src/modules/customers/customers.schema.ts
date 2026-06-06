import { z } from 'zod';

// E.164-ish: optional leading +, 7–15 digits.
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;
// UK VAT registration number: GB followed by 9 digits (standard) or 12 digits (branch).
const VAT_REGEX = /^GB[0-9]{9}([0-9]{3})?$/;

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().regex(PHONE_REGEX, 'Invalid phone number').optional().nullable(),
  email: z.string().email().optional().nullable(),
  vatNumber: z.string().regex(VAT_REGEX, 'Invalid VAT number (e.g. GB123456789)').optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  vehicleNo: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export const customerIdSchema = z.object({
  id: z.string().uuid(),
});

export const listCustomersQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
