import type { Request, Response, NextFunction } from 'express';
import * as customerService from './customers.service';
import { success, created, noContent, paginated } from '../../utils/apiResponse';
import type { ListCustomersQuery } from './customers.schema';

const cid = (req: Request) => req.params.id as string;

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customers, meta } = await customerService.listCustomers(
      req.query as unknown as ListCustomersQuery,
    );
    paginated(res, customers, meta);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customer = await customerService.getCustomer(cid(req));
    success(res, customer);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customer = await customerService.createCustomer(req.body);
    res.locals.auditAfter = customer;
    res.locals.auditEntityId = customer.id;
    created(res, customer);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customer = await customerService.updateCustomer(cid(req), req.body);
    res.locals.auditAfter = customer;
    success(res, customer);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await customerService.deleteCustomer(cid(req));
    noContent(res);
  } catch (err) {
    next(err);
  }
};
