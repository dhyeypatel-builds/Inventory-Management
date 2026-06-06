import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import {
  listInventoryQuerySchema,
  updateInventorySchema,
  adjustStockSchema,
  movementsQuerySchema,
  variantIdParamSchema,
} from './inventory.schema';
import * as inventoryController from './inventory.controller';

// ─── /api/v1/inventory ─────────────────────────────────────────────────────────

export const inventoryRouter = Router();

inventoryRouter.use(authenticate);

inventoryRouter.get(
  '/',
  requirePermission('inventory:read'),
  validate({ query: listInventoryQuerySchema }),
  inventoryController.list,
);

inventoryRouter.get(
  '/valuation',
  requirePermission('inventory:read'),
  inventoryController.valuation,
);

inventoryRouter.get(
  '/:variantId',
  requirePermission('inventory:read'),
  validate({ params: variantIdParamSchema }),
  inventoryController.getOne,
);

inventoryRouter.patch(
  '/:variantId',
  requirePermission('inventory:write'),
  validate({ params: variantIdParamSchema, body: updateInventorySchema }),
  auditLog('inventory'),
  inventoryController.update,
);

inventoryRouter.post(
  '/:variantId/adjust',
  requirePermission('inventory:write'),
  validate({ params: variantIdParamSchema, body: adjustStockSchema }),
  auditLog('inventory'),
  inventoryController.adjust,
);

inventoryRouter.get(
  '/:variantId/movements',
  requirePermission('inventory:read'),
  validate({ params: variantIdParamSchema, query: movementsQuerySchema }),
  inventoryController.movements,
);
