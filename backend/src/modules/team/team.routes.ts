import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { inviteStaffSchema, inviteIdSchema } from './team.schema';
import * as team from './team.controller';

export const teamRouter = Router();

teamRouter.use(authenticate, requirePermission('team:manage'));

teamRouter.get('/', team.list);
teamRouter.post('/invites', validate({ body: inviteStaffSchema.shape.body }), team.invite);
teamRouter.delete('/invites/:id', validate({ params: inviteIdSchema.shape.params }), team.revoke);
