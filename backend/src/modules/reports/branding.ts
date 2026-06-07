import { getSettings } from '../settings/settings.service';
import { getStorage } from '../../storage';
import { logger } from '../../config/logger';
import type { ReportBranding } from './templates/report-html';

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** Turn a stored logo URL (/api/v1/uploads/<key>) into an inline data URI. */
async function logoDataUri(logoUrl: string | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  const marker = '/api/v1/uploads/';
  const idx = logoUrl.indexOf(marker);
  if (idx === -1) return null;
  const key = logoUrl.slice(idx + marker.length);
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  const mime = MIME_BY_EXT[ext];
  if (!mime) return null;
  try {
    const bytes = await getStorage().get(key);
    return `data:${mime};base64,${bytes.toString('base64')}`;
  } catch (err) {
    logger.warn({ err, key }, 'could not inline report logo');
    return null;
  }
}

/** Branding for the current tenant's PDF reports (from settings + storage). */
export async function getReportBranding(): Promise<ReportBranding> {
  const settings = (await getSettings()) as {
    company?: { name?: string; vat_number?: string; logo_url?: string };
  };
  const company = settings.company ?? {};
  return {
    shopName: company.name?.trim() || 'TyreStock',
    vatNumber: company.vat_number?.trim() || undefined,
    logoDataUri: await logoDataUri(company.logo_url),
  };
}
