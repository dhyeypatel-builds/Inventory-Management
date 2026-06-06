import type { Request, Response, NextFunction } from 'express';
import * as productService from './products.service';
import { success, created, noContent, paginated } from '../../utils/apiResponse';
import type { ListProductsQuery } from './products.schema';

const pid = (req: Request) => req.params.id as string;

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { products, meta } = await productService.listProducts(
      req.query as unknown as ListProductsQuery,
    );
    paginated(res, products, meta);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await productService.getProduct(pid(req));
    success(res, product);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await productService.createProduct(req.body, req.user?.id);
    res.locals.auditAfter = { id: product.id, name: product.name };
    res.locals.auditEntityId = product.id;
    created(res, product);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await productService.updateProduct(pid(req), req.body);
    res.locals.auditAfter = product;
    success(res, product);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await productService.deleteProduct(pid(req));
    noContent(res);
  } catch (err) {
    next(err);
  }
};

export const addVariant = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const variant = await productService.addVariant(pid(req), req.body, req.user?.id);
    res.locals.auditAfter = { id: variant.id, sku: variant.sku };
    res.locals.auditEntityId = variant.id;
    created(res, variant);
  } catch (err) {
    next(err);
  }
};

export const updateVariant = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const variant = await productService.updateVariant(pid(req), req.body);
    res.locals.auditAfter = variant;
    success(res, variant);
  } catch (err) {
    next(err);
  }
};
