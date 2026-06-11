import type { Request, Response, NextFunction } from 'express';
import * as purchasesService from './purchases.service';
import { success, created, paginated } from '../../utils/apiResponse';
import type { ListVendorsQuery, ListPurchasesQuery } from './purchases.schema';

// ─── Vendors ─────────────────────────────────────────────────────────────────

export const listVendors = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { vendors, meta } = await purchasesService.listVendors(
      req.query as unknown as ListVendorsQuery,
    );
    paginated(res, vendors, meta);
  } catch (err) {
    next(err);
  }
};

export const createVendor = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const vendor = await purchasesService.createVendor(req.body);
    res.locals.auditAfter = vendor;
    res.locals.auditEntityId = vendor.id;
    created(res, vendor);
  } catch (err) {
    next(err);
  }
};

export const updateVendor = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const vendor = await purchasesService.updateVendor(req.params.id as string, req.body);
    res.locals.auditAfter = vendor;
    res.locals.auditEntityId = vendor.id;
    success(res, vendor);
  } catch (err) {
    next(err);
  }
};

// ─── Purchases ───────────────────────────────────────────────────────────────

export const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const purchase = await purchasesService.createPurchase(req.body, req.user?.id);
    res.locals.auditAfter = {
      id: purchase.id,
      invoiceNo: purchase.invoiceNo,
      grandTotal: purchase.grandTotal,
    };
    res.locals.auditEntityId = purchase.id;
    created(res, purchase);
  } catch (err) {
    next(err);
  }
};

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { items, meta } = await purchasesService.listPurchases(
      req.query as unknown as ListPurchasesQuery,
    );
    paginated(res, items, meta);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const purchase = await purchasesService.getPurchase(req.params.id as string);
    success(res, purchase);
  } catch (err) {
    next(err);
  }
};

// ─── Serial numbers ──────────────────────────────────────────────────────────

export const getSerial = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    success(res, await purchasesService.getSerial(req.params.serialNo as string));
  } catch (err) {
    next(err);
  }
};

export const updateSerial = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const serial = await purchasesService.updateSerialStatus(
      req.params.serialNo as string,
      req.body,
    );
    res.locals.auditAfter = { serialNo: serial.serialNo, status: serial.status };
    res.locals.auditEntityId = serial.id;
    success(res, serial);
  } catch (err) {
    next(err);
  }
};
