import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { EXPORT_ENTITIES, exportEntityCsv, type ExportEntity } from './exports.service';

const exportParamsSchema = z.object({
  entity: z.enum(EXPORT_ENTITIES),
});

const download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { filename, csv } = await exportEntityCsv(req.params.entity as ExportEntity);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

export const exportsRouter = Router();

// Raw data export — owners/auditors (report:export) only.
exportsRouter.get(
  '/:entity',
  authenticate,
  requirePermission('report:export'),
  validate({ params: exportParamsSchema }),
  download,
);
