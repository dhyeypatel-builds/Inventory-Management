import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authRateLimiter, otpRequestRateLimiter } from '../../middleware/rateLimit';
import {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  otpRequestSchema,
  otpVerifySchema,
  inviteTokenSchema,
} from './auth.schema';
import * as authController from './auth.controller';
import * as passwordless from './passwordless.controller';

export const authRouter = Router();

// Public — rate-limited
authRouter.post('/login',
  authRateLimiter,
  validate({ body: loginSchema.shape.body }),
  authController.login,
);

// ─── Passwordless (Phase 2C) ────────────────────────────────────────────────

// Email OTP: request a code (per-email + per-IP limited), then verify it.
authRouter.post('/otp/request',
  otpRequestRateLimiter,
  authRateLimiter,
  validate({ body: otpRequestSchema.shape.body }),
  passwordless.otpRequest,
);

authRouter.post('/otp/verify',
  authRateLimiter,
  validate({ body: otpVerifySchema.shape.body }),
  passwordless.otpVerify,
);

// Invite accept page lookup.
authRouter.get('/invite/:token',
  validate({ params: inviteTokenSchema.shape.params }),
  passwordless.getInvite,
);

authRouter.post('/refresh',
  authRateLimiter,
  validate({ body: refreshSchema.shape.body }),
  authController.refresh,
);

authRouter.post('/logout',
  validate({ body: refreshSchema.shape.body }),
  authController.logout,
);

// Protected
authRouter.get('/me', authenticate, authController.me);

authRouter.post('/change-password',
  authenticate,
  validate({ body: changePasswordSchema.shape.body }),
  authController.changePassword,
);
