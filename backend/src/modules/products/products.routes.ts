import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import {
  createProductSchema,
  updateProductSchema,
  productIdSchema,
  variantBodySchema,
  variantIdSchema,
  updateVariantSchema,
  listProductsQuerySchema,
  variantSearchQuerySchema,
} from './products.schema';
import * as productController from './products.controller';
import * as variantsController from './variants.controller';

// ─── /api/v1/products ─────────────────────────────────────────────────────────

export const productsRouter = Router();

productsRouter.use(authenticate);

productsRouter.get(
  '/',
  requirePermission('product:read'),
  validate({ query: listProductsQuerySchema }),
  productController.list,
);

productsRouter.post(
  '/',
  requirePermission('product:write'),
  validate({ body: createProductSchema }),
  auditLog('product'),
  productController.create,
);

productsRouter.get(
  '/:id',
  requirePermission('product:read'),
  validate({ params: productIdSchema }),
  productController.getOne,
);

productsRouter.patch(
  '/:id',
  requirePermission('product:write'),
  validate({ params: productIdSchema, body: updateProductSchema }),
  auditLog('product'),
  productController.update,
);

productsRouter.delete(
  '/:id',
  requirePermission('product:write'),
  validate({ params: productIdSchema }),
  auditLog('product'),
  productController.remove,
);

productsRouter.post(
  '/:id/variants',
  requirePermission('product:write'),
  validate({ params: productIdSchema, body: variantBodySchema }),
  auditLog('variant'),
  productController.addVariant,
);

// ─── /api/v1/variants ─────────────────────────────────────────────────────────

export const variantsRouter = Router();

variantsRouter.use(authenticate);

variantsRouter.get(
  '/',
  requirePermission('product:read'),
  validate({ query: variantSearchQuerySchema }),
  variantsController.search,
);

variantsRouter.patch(
  '/:id',
  requirePermission('product:write'),
  validate({ params: variantIdSchema, body: updateVariantSchema }),
  auditLog('variant'),
  productController.updateVariant,
);
