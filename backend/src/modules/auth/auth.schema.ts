import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

export const refreshSchema = z.object({
  // Optional: the refresh token normally arrives in the httpOnly cookie. The
  // body field remains for transitional/non-browser clients.
  body: z.object({
    refreshToken: z.string().min(1).optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(8, 'Current password must be at least 8 characters'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  }),
});

// ─── Passwordless (Phase 2C) ────────────────────────────────────────────────

export const otpRequestSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const otpVerifySchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  }),
});

export const inviteTokenSchema = z.object({
  params: z.object({
    token: z.string().min(10),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshInput = z.infer<typeof refreshSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
export type OtpRequestInput = z.infer<typeof otpRequestSchema>['body'];
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>['body'];
