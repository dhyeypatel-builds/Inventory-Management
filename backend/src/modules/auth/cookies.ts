import type { Response } from 'express';
import { env } from '../../config/env';

/** Name of the httpOnly refresh-token cookie. */
export const REFRESH_COOKIE = 'ts_refresh';

/** Parse a JWT-style duration ('7d', '15m', '900s', '24h') into milliseconds. */
function durationMs(value: string): number {
  const m = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2] ?? 's';
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return n * mult;
}

/**
 * Shared cookie options. httpOnly keeps the token out of JS (XSS-safe); Secure in
 * production; SameSite=Lax allows the OAuth redirect to carry it back. Scoped to
 * the auth path so it's only ever sent to /auth/* requests.
 */
function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/v1/auth',
    maxAge: durationMs(env.JWT_REFRESH_EXPIRES_IN),
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, cookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  // clearCookie must match the path/options the cookie was set with.
  const { maxAge: _maxAge, ...opts } = cookieOptions();
  res.clearCookie(REFRESH_COOKIE, opts);
}
