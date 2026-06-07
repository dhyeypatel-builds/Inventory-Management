import type { Request, Response, NextFunction } from 'express';
import * as platformAuth from './platform-auth.service';
import { success } from '../../utils/apiResponse';

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await platformAuth.platformLogin(req.body.email, req.body.password));
  } catch (err) {
    next(err);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await platformAuth.getPlatformAdmin(req.platformAdmin!.id));
  } catch (err) {
    next(err);
  }
};
