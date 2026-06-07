import { withPage } from './browser-pool';

export interface PdfOptions {
  landscape?: boolean;
  /** Footer template (Chrome print footer; supports pageNumber/totalPages spans). */
  footerHtml?: string;
}

/**
 * Renders an HTML string to a PDF buffer using the shared headless Chrome.
 * `print` media is emulated so @media print CSS applies.
 */
export async function htmlToPdf(html: string, opts: PdfOptions = {}): Promise<Buffer> {
  return withPage(async (page) => {
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'load' });

    const data = await page.pdf({
      format: 'A4',
      landscape: opts.landscape ?? false,
      printBackground: true,
      margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
      displayHeaderFooter: Boolean(opts.footerHtml),
      headerTemplate: '<span></span>',
      footerTemplate: opts.footerHtml ?? '<span></span>',
    });
    return Buffer.from(data);
  });
}
