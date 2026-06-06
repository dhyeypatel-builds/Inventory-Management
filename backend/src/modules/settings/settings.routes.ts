import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import { updateSettingsSchema } from './settings.schema';
import * as settingsController from './settings.controller';

// ─── /api/v1/settings ────────────────────────────────────────────────────────

export const settingsRouter = Router();

settingsRouter.use(authenticate);

settingsRouter.get('/', requirePermission('settings:read'), settingsController.getAll);

settingsRouter.patch(
  '/',
  requirePermission('settings:write'),
  validate({ body: updateSettingsSchema }),
  auditLog('settings'),
  settingsController.update,
);
