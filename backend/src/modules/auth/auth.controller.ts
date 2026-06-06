import type { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { success } from '../../utils/apiResponse';

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, userId } = await authService.rotateRefreshToken(req.body.refreshToken);

    // Re-fetch permissions for the new access token
    const me = await authService.getMe(userId);
    const accessToken = authService.signAccessToken({
      sub: userId,
      role: me.role,
      permissions: me.permissions,
      tenantId: me.tenantId,
    });

    success(res, { accessToken, refreshToken: token });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await authService.logout(req.body.refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await authService.getMe(req.user!.id);
    success(res, user);
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await authService.changePassword(
      req.user!.id,
      req.body.currentPassword,
      req.body.newPassword,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
