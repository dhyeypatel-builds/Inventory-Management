import { existsSync } from 'fs';
import type { Browser, Page } from 'puppeteer-core';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Loaded lazily so importing the app (e.g. in Jest) never pulls puppeteer-core's
// ESM graph — it's only needed when a PDF is actually rendered.
async function loadPuppeteer() {
  return (await import('puppeteer-core')).default;
}

// Common Chrome/Chromium locations, probed when CHROME_PATH is unset.
const CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
];

function resolveExecutable(): string {
  if (env.CHROME_PATH) return env.CHROME_PATH;
  const found = CANDIDATES.find((p) => existsSync(p));
  if (!found) {
    throw new Error('No Chrome/Chromium found. Set CHROME_PATH or install Chromium.');
  }
  return found;
}

/**
 * A single long-lived headless Chrome, reused across renders (never spawned per
 * request). Relaunches transparently if it has crashed or disconnected.
 */
let browserPromise: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  const executablePath = resolveExecutable();
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  browser.on('disconnected', () => {
    logger.warn('PDF browser disconnected; will relaunch on next render');
    browserPromise = null;
  });
  logger.info({ executablePath }, 'PDF browser launched');
  return browser;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = launch();
  try {
    const browser = await browserPromise;
    if (!browser.connected) {
      browserPromise = null;
      return getBrowser();
    }
    return browser;
  } catch (err) {
    browserPromise = null;
    throw err;
  }
}

/**
 * Runs `fn` with a fresh page on the shared browser, always closing the page.
 * One retry if the browser died between getBrowser() and newPage().
 */
export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const browser = await getBrowser();
    let page: Page | undefined;
    try {
      page = await browser.newPage();
      return await fn(page);
    } catch (err) {
      if (attempt === 0 && !browser.connected) {
        browserPromise = null;
        continue; // relaunch and retry once
      }
      throw err;
    } finally {
      await page?.close().catch(() => {});
    }
  }
  throw new Error('PDF render failed after relaunch');
}

/** Closes the shared browser (graceful shutdown / tests). */
export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    browserPromise = null;
    await browser?.close().catch(() => {});
  }
}
