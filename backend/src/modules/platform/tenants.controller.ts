import type { Request, Response, NextFunction } from 'express';
import * as tenants from './tenants.service';
import { success, created } from '../../utils/apiResponse';

const auditCtx = (req: Request) => ({ actorId: req.platformAdmin?.id, ip: req.ip });

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(
      res,
      await tenants.listTenants({
        status: req.query.status as string | undefined,
        q: req.query.q as string | undefined,
      }),
    );
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await tenants.getTenant(req.params.id as string));
  } catch (err) {
    next(err);
  }
};

export const provision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    created(res, await tenants.provisionTenant(req.body, auditCtx(req)));
  } catch (err) {
    next(err);
  }
};

export const suspend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await tenants.suspendTenant(req.params.id as string, auditCtx(req)));
  } catch (err) {
    next(err);
  }
};

export const reactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await tenants.reactivateTenant(req.params.id as string, auditCtx(req)));
  } catch (err) {
    next(err);
  }
};

export const impersonate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await tenants.impersonateTenant(req.params.id as string, auditCtx(req)));
  } catch (err) {
    next(err);
  }
};
