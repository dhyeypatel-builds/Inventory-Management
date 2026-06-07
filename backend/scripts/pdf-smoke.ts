/**
 * Branded-PDF smoke test (Phase 2D). Generates a real report PDF for the default
 * tenant and a PNG of the template for a visual check. Run: npx tsx scripts/pdf-smoke.ts
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { runWithTenant } from '../src/tenancy/context';
import { generateReport } from '../src/modules/reports/reports.service';
import { renderReportHtml, REPORT_FOOTER_HTML } from '../src/modules/reports/templates/report-html';
import { getReportBranding } from '../src/modules/reports/branding';
import { htmlToPdf } from '../src/render/pdf.service';
import { withPage, closeBrowser } from '../src/render/browser-pool';

const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';

async function main(): Promise<void> {
  const reportName = (process.argv[2] ?? 'best-selling-brands') as Parameters<typeof generateReport>[0];
  await runWithTenant({ tenantId: DEFAULT_TENANT, platform: false }, async () => {
    const report = await generateReport(reportName, {});
    const branding = await getReportBranding();
    console.log('Branding:', branding.shopName, branding.vatNumber ?? '(no VAT)', branding.logoDataUri ? '(logo)' : '(no logo)');
    console.log('Rows:', report.rows.length);

    const html = renderReportHtml(report, branding);

    const pdf = await htmlToPdf(html, { landscape: true, footerHtml: REPORT_FOOTER_HTML });
    writeFileSync('/tmp/report.pdf', pdf);
    const isPdf = pdf.subarray(0, 4).toString('latin1') === '%PDF';
    console.log(`PDF: ${pdf.length} bytes, valid header: ${isPdf} → /tmp/report.pdf`);

    // Visual of the template (full page screenshot).
    await withPage(async (page) => {
      await page.setViewport({ width: 1400, height: 900 });
      await page.setContent(html, { waitUntil: 'load' });
      await page.screenshot({ path: '/tmp/report.png', fullPage: true });
    });
    console.log('Template screenshot → /tmp/report.png');
  });
  await closeBrowser();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
