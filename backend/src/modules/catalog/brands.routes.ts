import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import {
  createBrandSchema,
  updateBrandSchema,
  brandIdSchema,
  listBrandsQuerySchema,
} from './brands.schema';
import * as brandController from './brands.controller';

export const brandsRouter = Router();

brandsRouter.use(authenticate);

brandsRouter.get(
  '/',
  requirePermission('catalog:read'),
  validate({ query: listBrandsQuerySchema }),
  brandController.list,
);

brandsRouter.post(
  '/',
  requirePermission('catalog:write'),
  validate({ body: createBrandSchema }),
  auditLog('brand'),
  brandController.create,
);

brandsRouter.get(
  '/:id',
  requirePermission('catalog:read'),
  validate({ params: brandIdSchema }),
  brandController.getOne,
);

brandsRouter.patch(
  '/:id',
  requirePermission('catalog:write'),
  validate({ params: brandIdSchema, body: updateBrandSchema }),
  auditLog('brand'),
  brandController.update,
);

brandsRouter.delete(
  '/:id',
  requirePermission('catalog:write'),
  validate({ params: brandIdSchema }),
  auditLog('brand'),
  brandController.remove,
);
