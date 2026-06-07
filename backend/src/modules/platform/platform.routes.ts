import { Router } from 'express';
import { requirePlatform } from '../../middleware/platform-auth';
import { validate } from '../../middleware/validate';
import { platformLoginSchema } from './platform-auth.schema';
import { provisionTenantSchema, tenantIdSchema, listTenantsQuerySchema } from './tenants.schema';
import * as authCtrl from './platform-auth.controller';
import * as tenantCtrl from './tenants.controller';

// ─── /api/v1/platform ───────────────────────────────────────────────────────

export const platformRouter = Router();

// Public — platform login.
platformRouter.post('/auth/login', validate({ body: platformLoginSchema }), authCtrl.login);

// Everything below requires a platform-admin token.
platformRouter.get('/auth/me', requirePlatform, authCtrl.me);

platformRouter.get(
  '/tenants',
  requirePlatform,
  validate({ query: listTenantsQuerySchema }),
  tenantCtrl.list,
);
platformRouter.post(
  '/tenants',
  requirePlatform,
  validate({ body: provisionTenantSchema }),
  tenantCtrl.provision,
);
platformRouter.get(
  '/tenants/:id',
  requirePlatform,
  validate({ params: tenantIdSchema }),
  tenantCtrl.getOne,
);
platformRouter.post(
  '/tenants/:id/suspend',
  requirePlatform,
  validate({ params: tenantIdSchema }),
  tenantCtrl.suspend,
);
platformRouter.post(
  '/tenants/:id/reactivate',
  requirePlatform,
  validate({ params: tenantIdSchema }),
  tenantCtrl.reactivate,
);
platformRouter.post(
  '/tenants/:id/impersonate',
  requirePlatform,
  validate({ params: tenantIdSchema }),
  tenantCtrl.impersonate,
);
