import type { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/apiResponse';
import { requestOtp, verifyOtp } from './otp.service';
import { getInviteByToken } from './invite.service';
import { setRefreshCookie } from './cookies';

// ─── Email OTP ──────────────────────────────────────────────────────────────

export const otpRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await requestOtp(req.body.email);
    // Always identical — never reveals whether the email has an account.
    success(res, { message: 'If an account exists for that email, a code is on its way.' });
  } catch (err) {
    next(err);
  }
};

export const otpVerify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await verifyOtp(req.body.email, req.body.code);
    setRefreshCookie(res, result.refreshToken);
    success(res, result);
  } catch (err) {
    next(err);
  }
};

// ─── Invite lookup ────────────────────────────────────────────────────────────

export const getInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    success(res, await getInviteByToken(req.params.token as string));
  } catch (err) {
    next(err);
  }
};
