import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdSchema,
  listCategoriesQuerySchema,
} from './categories.schema';
import * as categoryController from './categories.controller';

export const categoriesRouter = Router();

categoriesRouter.use(authenticate);

categoriesRouter.get(
  '/',
  requirePermission('catalog:read'),
  validate({ query: listCategoriesQuerySchema }),
  categoryController.list,
);

categoriesRouter.post(
  '/',
  requirePermission('catalog:write'),
  validate({ body: createCategorySchema }),
  auditLog('category'),
  categoryController.create,
);

categoriesRouter.get(
  '/:id',
  requirePermission('catalog:read'),
  validate({ params: categoryIdSchema }),
  categoryController.getOne,
);

categoriesRouter.patch(
  '/:id',
  requirePermission('catalog:write'),
  validate({ params: categoryIdSchema, body: updateCategorySchema }),
  auditLog('category'),
  categoryController.update,
);

categoriesRouter.delete(
  '/:id',
  requirePermission('catalog:write'),
  validate({ params: categoryIdSchema }),
  auditLog('category'),
  categoryController.remove,
);
