import type { Request, Response, NextFunction } from 'express';
import * as categoryService from './categories.service';
import { success, created, noContent } from '../../utils/apiResponse';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await categoryService.listCategories(req.query as never);
    success(res, categories);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await categoryService.getCategory(Number(req.params.id));
    success(res, category);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await categoryService.createCategory(req.body);
    res.locals.auditAfter = category;
    res.locals.auditEntityId = String(category.id);
    created(res, category);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await categoryService.updateCategory(Number(req.params.id), req.body);
    res.locals.auditAfter = category;
    success(res, category);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await categoryService.deleteCategory(Number(req.params.id));
    noContent(res);
  } catch (err) {
    next(err);
  }
};
