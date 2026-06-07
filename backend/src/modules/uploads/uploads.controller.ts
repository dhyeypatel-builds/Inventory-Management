import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { getStorage } from '../../storage';
import { success } from '../../utils/apiResponse';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from '../../utils/errors';

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** POST /uploads/logo — store a tenant logo, return its URL. */
export const uploadLogo = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.file) throw new ValidationError('No file uploaded');
    const ext = EXT_BY_MIME[req.file.mimetype];
    if (!ext) throw new ValidationError('Unsupported image type (use PNG, JPEG or WebP)');

    // Read the tenant from the request (set synchronously by `authenticate`).
    // multer's async stream parsing severs the AsyncLocalStorage context, so we
    // can't rely on currentTenant() here — and this route does no scoped Prisma.
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedError('No tenant context');
    const stored = await getStorage().put({
      tenantId,
      folder: 'logos',
      filename: `${randomUUID()}.${ext}`,
      contentType: req.file.mimetype,
      body: req.file.buffer,
    });

    success(res, stored, 201);
  } catch (err) {
    next(err);
  }
};

/** GET /uploads/:tenantId/:folder/:filename — serve a stored object (tenant-scoped). */
export const serveObject = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { tenantId, folder, filename } = req.params as Record<string, string>;

    // A tenant user may only read their own tenant's objects; platform admins
    // (no tenantId on the token) may read any.
    if (req.user?.tenantId && req.user.tenantId !== tenantId) {
      throw new ForbiddenError('Not your tenant');
    }

    let buffer: Buffer;
    try {
      buffer = await getStorage().get(`${tenantId}/${folder}/${filename}`);
    } catch {
      throw new NotFoundError('File');
    }

    const ext = filename.split('.').pop()?.toLowerCase();
    const type =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};
