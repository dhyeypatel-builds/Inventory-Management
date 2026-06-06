// Dev-only visual harness: logs in, then screenshots one or more routes.
// Usage: node scripts/shoot.mjs /  /sales/pos  /inventory
import puppeteer from 'puppeteer-core';

const BASE = process.env.SHOOT_BASE ?? 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@tyrestock.app';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@123!';
const routes = process.argv.slice(2);
if (routes.length === 0) routes.push('/');

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

// Log in once.
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
await page.type('input[type="email"]', EMAIL);
await page.type('input[type="password"]', PASSWORD);
await Promise.all([
  page.click('button[type="submit"]'),
  page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
]);
await new Promise((r) => setTimeout(r, 1200));

for (const route of routes) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1400));
  const name = route === '/' ? 'dashboard' : route.replace(/^\//, '').replace(/\//g, '-');
  const out = `/tmp/ts-${name}.png`;
  await page.screenshot({ path: out, fullPage: true });
  console.log(`shot ${route} -> ${out}`);
}

await browser.close();
