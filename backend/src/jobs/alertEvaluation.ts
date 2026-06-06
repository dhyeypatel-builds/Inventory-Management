import { prisma } from '../db/prisma';
import { logger } from '../config/logger';
import { evaluateVariantAlerts } from '../modules/alerts/alerts.service';

/**
 * Batch alert evaluation.
 *
 * Scans every inventory row and reconciles its stock alerts. Movements
 * normally trigger inline re-evaluation via `reevaluateVariants`; this job is
 * the safety net — run it on a schedule or at startup to catch any variant
 * whose alert state may have drifted (e.g. reorder-level edits, manual DB
 * changes, or movements that bypassed the service layer).
 */
export async function evaluateAllAlerts(): Promise<{ evaluated: number; failed: number }> {
  const rows = await prisma.inventory.findMany({ select: { variantId: true } });

  let evaluated = 0;
  let failed = 0;
  for (const { variantId } of rows) {
    try {
      await evaluateVariantAlerts(variantId);
      evaluated += 1;
    } catch (err) {
      failed += 1;
      logger.error({ err, variantId }, 'Alert evaluation failed');
    }
  }

  logger.info({ evaluated, failed }, 'Alert evaluation job complete');
  return { evaluated, failed };
}
