import { Router, type Request, type Response, type NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { env } from '../../config/env';
import { ValidationError } from '../../utils/errors';
import * as uploads from './uploads.controller';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new ValidationError('Unsupported image type (use PNG, JPEG or WebP)'));
      return;
    }
    cb(null, true);
  },
});

// Run multer and translate its errors (e.g. file too large) into a 400.
const singleFile = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `File too large (max ${Math.round(env.UPLOAD_MAX_BYTES / 1024)} KB)`
          : err.message;
      next(new ValidationError(message));
      return;
    }
    next(err);
  });
};

export const uploadsRouter = Router();

// Store a tenant logo. Settings-managers only.
uploadsRouter.post(
  '/logo',
  authenticate,
  requirePermission('settings:write'),
  singleFile,
  uploads.uploadLogo,
);

// Serve a stored object (authenticated, tenant-scoped in the controller).
uploadsRouter.get('/:tenantId/:folder/:filename', authenticate, uploads.serveObject);
