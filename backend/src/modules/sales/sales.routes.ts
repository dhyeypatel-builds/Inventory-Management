import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import { createSaleSchema, saleIdSchema, listSalesQuerySchema, returnSaleSchema } from './sales.schema';
import * as salesController from './sales.controller';

// ─── /api/v1/sales ──────────────────────────────────────────────────────────

export const salesRouter = Router();

salesRouter.use(authenticate);

salesRouter.post(
  '/',
  requirePermission('sale:create'),
  validate({ body: createSaleSchema }),
  auditLog('sale'),
  salesController.create,
);

salesRouter.get(
  '/',
  requirePermission('sale:read'),
  validate({ query: listSalesQuerySchema }),
  salesController.list,
);

salesRouter.get(
  '/:id',
  requirePermission('sale:read'),
  validate({ params: saleIdSchema }),
  salesController.getOne,
);

salesRouter.get(
  '/:id/invoice',
  requirePermission('sale:read'),
  validate({ params: saleIdSchema }),
  salesController.getInvoice,
);

salesRouter.post(
  '/:id/cancel',
  requirePermission('sale:cancel'),
  validate({ params: saleIdSchema }),
  auditLog('sale'),
  salesController.cancel,
);

salesRouter.post(
  '/:id/return',
  requirePermission('sale:return'),
  validate({ params: saleIdSchema, body: returnSaleSchema }),
  auditLog('sale'),
  salesController.returnSale,
);
