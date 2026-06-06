import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import * as dashboardController from './dashboard.controller';

// ─── /api/v1/dashboard ───────────────────────────────────────────────────────

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

const read = requirePermission('dashboard:read');

dashboardRouter.get('/summary', read, dashboardController.summary);
dashboardRouter.get('/sales-trend', read, dashboardController.salesTrend);
dashboardRouter.get('/top-brands', read, dashboardController.topBrands);
dashboardRouter.get('/fast-moving', read, dashboardController.fastMoving);
