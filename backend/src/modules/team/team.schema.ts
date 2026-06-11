import { z } from 'zod';

export const STAFF_ROLES = ['ADMIN', 'SALES', 'INVENTORY', 'AUDITOR'] as const;

export const inviteStaffSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Name is required').max(120),
    email: z.string().email('Invalid email address'),
    roleName: z.enum(STAFF_ROLES),
  }),
});

export const inviteIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const updateMemberSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ isActive: z.boolean() }),
});

export type InviteStaffInput = z.infer<typeof inviteStaffSchema>['body'];
