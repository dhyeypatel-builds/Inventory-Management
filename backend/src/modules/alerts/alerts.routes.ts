import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import { listAlertsQuerySchema, alertIdParamSchema } from './alerts.schema';
import * as alertsController from './alerts.controller';

// ─── /api/v1/alerts ──────────────────────────────────────────────────────────

export const alertsRouter = Router();

alertsRouter.use(authenticate);

alertsRouter.get(
  '/',
  requirePermission('alert:read'),
  validate({ query: listAlertsQuerySchema }),
  alertsController.list,
);

alertsRouter.post(
  '/:id/acknowledge',
  requirePermission('alert:acknowledge'),
  validate({ params: alertIdParamSchema }),
  auditLog('alert'),
  alertsController.acknowledge,
);
