import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { productTypeIdSchema } from './productTypes.schema';
import * as productTypeController from './productTypes.controller';

export const productTypesRouter = Router();

productTypesRouter.use(authenticate);

productTypesRouter.get('/', requirePermission('catalog:read'), productTypeController.list);

productTypesRouter.get(
  '/:id',
  requirePermission('catalog:read'),
  validate({ params: productTypeIdSchema }),
  productTypeController.getOne,
);

productTypesRouter.get(
  '/:id/attributes',
  requirePermission('catalog:read'),
  validate({ params: productTypeIdSchema }),
  productTypeController.getAttributes,
);
