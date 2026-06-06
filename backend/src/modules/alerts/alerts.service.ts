import { Prisma, AlertStatus, AlertType } from '@prisma/client';
import { prisma, type TxClient } from '../../db/prisma';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { parsePagination, buildMeta } from '../../utils/pagination';
import { logger } from '../../config/logger';
import type { ListAlertsQuery } from './alerts.schema';

// The extended client and its transaction client share the same model surface,
// so the same evaluation logic runs standalone or inside a caller's transaction.
type Client = TxClient;

function alertMessage(type: AlertType, qty: number, threshold: number): string {
  return type === AlertType.OUT_OF_STOCK
    ? 'Out of stock'
    : `Low stock: ${qty} remaining (reorder level ${threshold})`;
}

/**
 * Move an alert into a new status. The `(variant_id, type, status)` unique
 * constraint allows only one row per slot, so any stale occupant of the target
 * slot is cleared first.
 */
async function setAlertStatus(
  client: Client,
  alert: { id: string; variantId: string; type: AlertType },
  status: AlertStatus,
): Promise<void> {
  await client.alert.deleteMany({
    where: { variantId: alert.variantId, type: alert.type, status, id: { not: alert.id } },
  });
  await client.alert.update({
    where: { id: alert.id },
    data: {
      status,
      resolvedAt: status === AlertStatus.RESOLVED ? new Date() : null,
    },
  });
}

/**
 * Reconcile a single variant's stock alerts against its current on-hand level.
 * - quantity 0           → OPEN OUT_OF_STOCK
 * - 0 < quantity ≤ reorder → OPEN LOW_STOCK
 * - quantity > reorder    → no open alert (existing ones resolved)
 *
 * Safe to call repeatedly: the unique constraint plus this reconciliation keep
 * at most one OPEN alert per variant.
 */
export async function evaluateVariantAlerts(
  variantId: string,
  client: Client = prisma,
): Promise<void> {
  const inv = await client.inventory.findUnique({ where: { variantId } });
  if (!inv) return;

  const qty = inv.quantity;
  const threshold = inv.reorderLevel;

  let desiredType: AlertType | null = null;
  if (qty <= 0) desiredType = AlertType.OUT_OF_STOCK;
  else if (qty <= threshold) desiredType = AlertType.LOW_STOCK;

  const openAlerts = await client.alert.findMany({
    where: { variantId, status: AlertStatus.OPEN },
  });

  // Resolve any OPEN alert whose condition no longer holds.
  for (const a of openAlerts) {
    if (a.type !== desiredType) {
      await setAlertStatus(client, a, AlertStatus.RESOLVED);
    }
  }

  if (desiredType && !openAlerts.some((a) => a.type === desiredType)) {
    // Defensively free the OPEN slot before creating (handles races).
    await client.alert.deleteMany({
      where: { variantId, type: desiredType, status: AlertStatus.OPEN },
    });
    await client.alert.create({
      data: {
        variantId,
        type: desiredType,
        status: AlertStatus.OPEN,
        message: alertMessage(desiredType, qty, threshold),
        currentQty: qty,
        threshold,
      },
    });
  }
}

/**
 * Re-evaluate a set of variants without letting alert bookkeeping fail the
 * caller's primary operation (a sale or stock adjustment). Errors are logged.
 */
export async function reevaluateVariants(variantIds: Iterable<string>): Promise<void> {
  for (const variantId of new Set(variantIds)) {
    try {
      await evaluateVariantAlerts(variantId);
    } catch (err) {
      logger.error({ err, variantId }, 'Alert re-evaluation failed');
    }
  }
}

// ─── List ─────────────────────────────────────────────────────────────────────

const alertInclude = {
  variant: {
    select: {
      sku: true,
      product: { select: { name: true, brand: { select: { name: true } } } },
    },
  },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatAlert(a: any) {
  return {
    id: a.id,
    variantId: a.variantId,
    sku: a.variant?.sku ?? null,
    productName: a.variant?.product?.name ?? null,
    brandName: a.variant?.product?.brand?.name ?? null,
    type: a.type,
    status: a.status,
    message: a.message,
    currentQty: a.currentQty,
    threshold: a.threshold,
    createdAt: a.createdAt,
    resolvedAt: a.resolvedAt,
  };
}

export const listAlerts = async (query: ListAlertsQuery) => {
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.AlertWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: alertInclude,
    }),
    prisma.alert.count({ where }),
  ]);

  return { items: rows.map(formatAlert), meta: buildMeta(page, pageSize, total) };
};

// ─── Acknowledge ───────────────────────────────────────────────────────────────

export const acknowledgeAlert = async (id: string) => {
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) throw new NotFoundError('Alert');
  if (alert.status !== AlertStatus.OPEN) {
    throw new ConflictError(`Alert is already ${alert.status.toLowerCase()}`);
  }

  await setAlertStatus(prisma, alert, AlertStatus.ACKNOWLEDGED);

  const updated = await prisma.alert.findUnique({ where: { id }, include: alertInclude });
  return formatAlert(updated);
};
