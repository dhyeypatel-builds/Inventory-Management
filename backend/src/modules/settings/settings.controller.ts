import type { Request, Response, NextFunction } from 'express';
import * as settingsService from './settings.service';
import { success } from '../../utils/apiResponse';

export const getAll = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    success(res, await settingsService.getSettings());
  } catch (err) {
    next(err);
  }
};

export const update = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const settings = await settingsService.updateSettings(req.body);
    res.locals.auditAfter = settings;
    res.locals.auditEntityId = 'settings';
    success(res, settings);
  } catch (err) {
    next(err);
  }
};
