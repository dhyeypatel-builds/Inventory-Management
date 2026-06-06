import type { Request, Response, NextFunction } from 'express';
import * as inventoryService from './inventory.service';
import { success, paginated } from '../../utils/apiResponse';
import type { ListInventoryQuery, MovementsQuery } from './inventory.schema';

const vid = (req: Request) => req.params.variantId as string;

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { items, meta } = await inventoryService.listInventory(
      req.query as unknown as ListInventoryQuery,
    );
    paginated(res, items, meta);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const inv = await inventoryService.getInventory(vid(req));
    success(res, inv);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const inv = await inventoryService.updateInventory(vid(req), req.body);
    res.locals.auditAfter = inv;
    res.locals.auditEntityId = inv.variantId;
    success(res, inv);
  } catch (err) {
    next(err);
  }
};

export const adjust = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const inv = await inventoryService.adjustStock(vid(req), req.body, req.user?.id);
    res.locals.auditAfter = { variantId: inv.variantId, onHand: inv.onHand };
    res.locals.auditEntityId = inv.variantId;
    success(res, inv);
  } catch (err) {
    next(err);
  }
};

export const valuation = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await inventoryService.getValuation();
    success(res, data);
  } catch (err) {
    next(err);
  }
};

export const movements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { items, meta } = await inventoryService.listMovements(
      vid(req),
      req.query as unknown as MovementsQuery,
    );
    paginated(res, items, meta);
  } catch (err) {
    next(err);
  }
};
