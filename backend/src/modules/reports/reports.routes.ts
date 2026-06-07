import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import * as reportsController from './reports.controller';
import { REPORT_NAMES } from './reports.service';

// ─── /api/v1/reports ─────────────────────────────────────────────────────────

export const reportsRouter = Router();

reportsRouter.use(authenticate);

const reportNameParamSchema = z.object({
  name: z.enum(REPORT_NAMES),
});

const reportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

const exportQuerySchema = reportQuerySchema.extend({
  format: z.enum(['csv', 'xlsx', 'pdf']).optional(),
});

reportsRouter.get(
  '/:name',
  requirePermission('report:read'),
  validate({ params: reportNameParamSchema, query: reportQuerySchema }),
  reportsController.getReport,
);

reportsRouter.get(
  '/:name/export',
  requirePermission('report:export'),
  validate({ params: reportNameParamSchema, query: exportQuerySchema }),
  reportsController.exportReport,
);
