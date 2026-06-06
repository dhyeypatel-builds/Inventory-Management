import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { currentTenant } from '../../tenancy/context';
import type { UpdateSettingsInput } from './settings.schema';

type NestedSettings = Record<string, Record<string, unknown> | unknown>;

// Build a nested object grouped by the dotted key prefix.
function nest(rows: { key: string; value: unknown }[]): NestedSettings {
  const out: NestedSettings = {};
  for (const { key, value } of rows) {
    const idx = key.indexOf('.');
    if (idx === -1) {
      out[key] = value;
      continue;
    }
    const group = key.slice(0, idx);
    const field = key.slice(idx + 1);
    const bucket = (out[group] as Record<string, unknown>) ?? {};
    bucket[field] = value;
    out[group] = bucket;
  }
  return out;
}

// Flatten the nested patch into `{ key: 'group.field', value }` upsert pairs.
function flatten(patch: UpdateSettingsInput): { key: string; value: unknown }[] {
  const out: { key: string; value: unknown }[] = [];
  for (const [group, fields] of Object.entries(patch)) {
    if (!fields || typeof fields !== 'object') continue;
    for (const [field, value] of Object.entries(fields as Record<string, unknown>)) {
      if (value !== undefined) out.push({ key: `${group}.${field}`, value });
    }
  }
  return out;
}

export const getSettings = async (): Promise<NestedSettings> => {
  const rows = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
  return nest(rows.map((r) => ({ key: r.key, value: r.value })));
};

export const updateSettings = async (patch: UpdateSettingsInput): Promise<NestedSettings> => {
  const pairs = flatten(patch);
  const tenantId = currentTenant();

  await prisma.$transaction(
    pairs.map(({ key, value }) =>
      prisma.setting.upsert({
        where: { tenantId_key: { tenantId, key } },
        update: { value: value as Prisma.InputJsonValue },
        create: { tenantId, key, value: value as Prisma.InputJsonValue },
      }),
    ),
  );

  return getSettings();
};
