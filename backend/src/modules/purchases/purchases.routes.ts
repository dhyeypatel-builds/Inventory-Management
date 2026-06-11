import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import {
  createVendorSchema,
  updateVendorSchema,
  vendorIdSchema,
  listVendorsQuerySchema,
  createPurchaseSchema,
  listPurchasesQuerySchema,
  purchaseIdSchema,
  serialNoParamSchema,
  updateSerialSchema,
} from './purchases.schema';
import * as purchasesController from './purchases.controller';

// ─── /api/v1/vendors ─────────────────────────────────────────────────────────

export const vendorsRouter = Router();
vendorsRouter.use(authenticate);

vendorsRouter.get(
  '/',
  requirePermission('vendor:read'),
  validate({ query: listVendorsQuerySchema }),
  purchasesController.listVendors,
);

vendorsRouter.post(
  '/',
  requirePermission('vendor:write'),
  validate({ body: createVendorSchema }),
  auditLog('vendor'),
  purchasesController.createVendor,
);

vendorsRouter.patch(
  '/:id',
  requirePermission('vendor:write'),
  validate({ params: vendorIdSchema, body: updateVendorSchema }),
  auditLog('vendor'),
  purchasesController.updateVendor,
);

// ─── /api/v1/purchases ───────────────────────────────────────────────────────

export const purchasesRouter = Router();
purchasesRouter.use(authenticate);

purchasesRouter.get(
  '/',
  requirePermission('purchase:read'),
  validate({ query: listPurchasesQuerySchema }),
  purchasesController.list,
);

purchasesRouter.post(
  '/',
  requirePermission('purchase:create'),
  validate({ body: createPurchaseSchema }),
  auditLog('purchase'),
  purchasesController.create,
);

purchasesRouter.get(
  '/:id',
  requirePermission('purchase:read'),
  validate({ params: purchaseIdSchema }),
  purchasesController.getOne,
);

// ─── /api/v1/serials ─────────────────────────────────────────────────────────

export const serialsRouter = Router();
serialsRouter.use(authenticate);

serialsRouter.get(
  '/:serialNo',
  requirePermission('purchase:read'),
  validate({ params: serialNoParamSchema }),
  purchasesController.getSerial,
);

serialsRouter.patch(
  '/:serialNo',
  requirePermission('purchase:create'),
  validate({ params: serialNoParamSchema, body: updateSerialSchema }),
  auditLog('serial'),
  purchasesController.updateSerial,
);
