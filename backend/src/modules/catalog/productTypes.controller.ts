import type { Request, Response, NextFunction } from 'express';
import * as productTypeService from './productTypes.service';
import { success } from '../../utils/apiResponse';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const types = await productTypeService.listProductTypes(includeInactive);
    success(res, types);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const type = await productTypeService.getProductType(Number(req.params.id));
    success(res, type);
  } catch (err) {
    next(err);
  }
};

export const getAttributes = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const attributes = await productTypeService.getProductTypeAttributes(Number(req.params.id));
    success(res, attributes);
  } catch (err) {
    next(err);
  }
};
