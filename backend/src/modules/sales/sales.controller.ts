import type { Request, Response, NextFunction } from 'express';
import * as salesService from './sales.service';
import { success, created, paginated } from '../../utils/apiResponse';
import type { ListSalesQuery } from './sales.schema';

const sid = (req: Request) => req.params.id as string;

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idempotencyKey =
      (req.headers['idempotency-key'] as string | undefined)?.trim() || undefined;

    const sale = await salesService.createSale(
      req.body,
      req.user?.id,
      idempotencyKey,
      req.user?.permissions ?? [],
    );
    res.locals.auditAfter = { id: sale.id, invoiceNo: sale.invoiceNo, grandTotal: sale.grandTotal };
    res.locals.auditEntityId = sale.id;
    created(res, sale);
  } catch (err) {
    next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { items, meta } = await salesService.listSales(
      req.query as unknown as ListSalesQuery,
    );
    paginated(res, items, meta);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sale = await salesService.getSale(sid(req));
    success(res, sale);
  } catch (err) {
    next(err);
  }
};

export const cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sale = await salesService.cancelSale(sid(req), req.user?.id);
    res.locals.auditAfter = { id: sale.id, status: sale.status };
    res.locals.auditEntityId = sale.id;
    success(res, sale);
  } catch (err) {
    next(err);
  }
};

export const returnSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sale = await salesService.returnSale(sid(req), req.body, req.user?.id);
    res.locals.auditAfter = { id: sale.id, status: sale.status };
    res.locals.auditEntityId = sale.id;
    success(res, sale);
  } catch (err) {
    next(err);
  }
};

export const getInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invoice = await salesService.getSaleInvoice(sid(req));
    success(res, invoice);
  } catch (err) {
    next(err);
  }
};

export const emailInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await salesService.emailSaleInvoice(sid(req), req.body.email);
    res.locals.auditAfter = { id: sid(req), email: result.email };
    res.locals.auditEntityId = sid(req);
    success(res, result);
  } catch (err) {
    next(err);
  }
};
