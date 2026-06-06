import type { Request, Response, NextFunction } from 'express';
import * as alertService from './alerts.service';
import { success, paginated } from '../../utils/apiResponse';
import type { ListAlertsQuery } from './alerts.schema';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { items, meta } = await alertService.listAlerts(
      req.query as unknown as ListAlertsQuery,
    );
    paginated(res, items, meta);
  } catch (err) {
    next(err);
  }
};

export const acknowledge = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const alert = await alertService.acknowledgeAlert(req.params.id as string);
    res.locals.auditAfter = { id: alert.id, status: alert.status };
    res.locals.auditEntityId = alert.id;
    success(res, alert);
  } catch (err) {
    next(err);
  }
};
