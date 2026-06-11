import type { Request, Response, NextFunction } from 'express';
import * as team from './team.service';
import { success, created, noContent } from '../../utils/apiResponse';

export const list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await team.listTeam());
  } catch (err) {
    next(err);
  }
};

export const invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    created(res, await team.inviteStaff(req.body, req.user!.id));
  } catch (err) {
    next(err);
  }
};

export const revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await team.revokeInvite(req.params.id as string);
    noContent(res);
  } catch (err) {
    next(err);
  }
};

export const updateMember = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    res.locals.auditEntityId = req.params.id as string;
    success(res, await team.setMemberActive(req.params.id as string, req.body.isActive, req.user!.id));
  } catch (err) {
    next(err);
  }
};
