import type { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { success } from '../../utils/apiResponse';
import { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie } from './cookies';
import { ValidationError } from '../../utils/errors';

/** The refresh token comes from the httpOnly cookie, falling back to the body
 *  (transitional — the cookie is the secure path; body support is removed once
 *  every client is migrated). */
const readRefreshToken = (req: Request): string | undefined =>
  (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? (req.body?.refreshToken as string | undefined);

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    setRefreshCookie(res, result.refreshToken);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const presented = readRefreshToken(req);
    if (!presented) throw new ValidationError('Refresh token is required');

    const { token, userId } = await authService.rotateRefreshToken(presented);

    // Re-fetch permissions for the new access token
    const me = await authService.getMe(userId);
    const accessToken = authService.signAccessToken({
      sub: userId,
      role: me.role,
      permissions: me.permissions,
      tenantId: me.tenantId,
    });

    setRefreshCookie(res, token);
    success(res, { accessToken, refreshToken: token });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const presented = readRefreshToken(req);
    if (presented) await authService.logout(presented);
    clearRefreshCookie(res);
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
