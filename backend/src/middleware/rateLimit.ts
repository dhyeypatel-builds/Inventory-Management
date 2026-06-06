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
