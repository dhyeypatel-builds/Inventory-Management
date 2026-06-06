import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimit';
import { loginSchema, refreshSchema, changePasswordSchema } from './auth.schema';
import * as authController from './auth.controller';

export const authRouter = Router();

// Public — rate-limited
authRouter.post('/login',
  authRateLimiter,
  validate({ body: loginSchema.shape.body }),
  authController.login,
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
