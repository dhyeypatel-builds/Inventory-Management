import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import * as onboarding from './onboarding.controller';

export const onboardingRouter = Router();

onboardingRouter.use(authenticate);

// Finish the first-run wizard.
onboardingRouter.post('/complete', onboarding.complete);

// Optional sample data (settings-managers only).
onboardingRouter.post('/demo-seed', requirePermission('settings:write'), onboarding.demoSeed);
onboardingRouter.post('/demo-seed/clear', requirePermission('settings:write'), onboarding.clearDemo);
