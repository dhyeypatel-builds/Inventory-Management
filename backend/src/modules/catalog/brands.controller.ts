import type { Request, Response, NextFunction } from 'express';
import * as brandService from './brands.service';
import { success, created, noContent, paginated } from '../../utils/apiResponse';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { brands, meta } = await brandService.listBrands(req.query as never);
    paginated(res, brands, meta);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brand = await brandService.getBrand(Number(req.params.id));
    success(res, brand);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brand = await brandService.createBrand(req.body);
    res.locals.auditAfter = brand;
    res.locals.auditEntityId = String(brand.id);
    created(res, brand);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const brand = await brandService.updateBrand(Number(req.params.id), req.body);
    res.locals.auditAfter = brand;
    success(res, brand);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await brandService.deleteBrand(Number(req.params.id));
    noContent(res);
  } catch (err) {
    next(err);
  }
};
