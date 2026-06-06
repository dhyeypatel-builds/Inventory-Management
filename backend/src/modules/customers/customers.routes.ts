import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { auditLog } from '../../middleware/audit';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerIdSchema,
  listCustomersQuerySchema,
} from './customers.schema';
import * as customerController from './customers.controller';

// ─── /api/v1/customers ──────────────────────────────────────────────────────

export const customersRouter = Router();

customersRouter.use(authenticate);

customersRouter.get(
  '/',
  requirePermission('customer:read'),
  validate({ query: listCustomersQuerySchema }),
  customerController.list,
);

customersRouter.post(
  '/',
  requirePermission('customer:write'),
  validate({ body: createCustomerSchema }),
  auditLog('customer'),
  customerController.create,
);

customersRouter.get(
  '/:id',
  requirePermission('customer:read'),
  validate({ params: customerIdSchema }),
  customerController.getOne,
);

customersRouter.patch(
  '/:id',
  requirePermission('customer:write'),
  validate({ params: customerIdSchema, body: updateCustomerSchema }),
  auditLog('customer'),
  customerController.update,
);

customersRouter.delete(
  '/:id',
  requirePermission('customer:write'),
  validate({ params: customerIdSchema }),
  auditLog('customer'),
  customerController.remove,
);
