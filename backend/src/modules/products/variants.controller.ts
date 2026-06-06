import type { Request, Response, NextFunction } from 'express';
import * as productService from './products.service';
import { paginated } from '../../utils/apiResponse';
import type { VariantSearchQuery } from './products.schema';

export const search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { variants, meta } = await productService.searchVariants(
      req.query as unknown as VariantSearchQuery,
    );
    paginated(res, variants, meta);
  } catch (err) {
    next(err);
  }
};
