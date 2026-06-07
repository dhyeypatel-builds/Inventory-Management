import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

const errorBody = (code: string, message: string) => ({
  success: false,
  error: { code, message },
});

/** Global rate limit: 100 requests / minute per IP */
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorBody('RATE_LIMITED', 'Too many requests, please try again later'),
  skip: (req) => isTest || req.path === '/api/v1/health',
});

/** Stricter limit for auth endpoints: 10 requests / minute per IP */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorBody('RATE_LIMITED', 'Too many authentication attempts'),
  skip: () => isTest,
});

/**
 * Per-email OTP request limit (on top of the per-IP authRateLimiter): 5 codes
 * per 15 minutes for a given email, so one address can't be spammed regardless
 * of the source IP. Falls back to the IP when no email is supplied.
 */
export const otpRequestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req): string => {
    const email = (req.body?.email as string | undefined)?.toLowerCase().trim();
    return email ? `otp:${email}` : `otp-ip:${req.ip}`;
  },
  message: errorBody('RATE_LIMITED', 'Too many codes requested. Try again later.'),
  skip: () => isTest,
});
