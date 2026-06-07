import type { Request, Response, NextFunction } from 'express';
import * as onboarding from './onboarding.service';
import { success } from '../../utils/apiResponse';

export const complete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await onboarding.completeOnboarding(req.user!.id));
  } catch (err) {
    next(err);
  }
};

export const demoSeed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await onboarding.runDemoSeed(req.user!.id));
  } catch (err) {
    next(err);
  }
};

export const clearDemo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await onboarding.clearDemoSeed());
  } catch (err) {
    next(err);
  }
};
