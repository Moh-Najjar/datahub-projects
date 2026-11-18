/**
 * Fidelity screen: loads every page on the original site and on the local build at one
 * viewport width, then reports page heights side by side, console errors and horizontal
 * overflow on the local version.
 *
 * Usage: node scripts/compare-pages.ts [localBase=http://localhost:3000] [width=1440] [ar]
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';

const [localBase = 'http://localhost:3000', widthArg = '1440', localeArg] = process.argv.slice(2);
const width = Number(widthArg);
const arabic = localeArg === 'ar';
const ORIGIN = 'https://datahubanalytics.com';

const routesSrc = await readFile(join(import.meta.dirname, '..', 'src', 'core', 'routes', 'paths.ts'), 'utf8');
const pagesSrc = await readFile(join(import.meta.dirname, '..', 'src', 'core', 'config', 'pages.ts'), 'utf8');
const routes = [...routesSrc.matchAll(/^\s+(\w+): '(\/[^']*)',/gm)]
  .map((m) => ({ key: m[1]!, path: m[2]! }))
  // DataHub's own pages do not exist on the original site, so there is nothing to compare.
  .filter((r) => r.key !== 'products')
  .filter((r) => !arabic || new RegExp(`\\n  ${r.key}: \\{\\n    locales: \\[[^\\]]*'ar'`).test(pagesSrc));

interface Measure {
  height: number;
  overflow: boolean;
  errors: string[];
}

async function measure(browser: Browser, url: string): Promise<Measure> {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += 700) {
      await page.evaluate((t) => window.scrollTo(0, t), y);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(500);
    return await page.evaluate((errs) => ({
      height: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      errors: errs,
    }), errors);
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch();
console.log(`Width ${width}px · ${arabic ? 'Arabic' : 'English'} · ${routes.length} pages\n`);
console.log('page'.padEnd(30), 'original'.padStart(9), 'local'.padStart(9), 'diff'.padStart(7), ' notes');
for (const { key, path } of routes) {
  const original = await measure(browser, `${ORIGIN}${path}${arabic ? '?lang=ar' : ''}`);
  const local = await measure(browser, `${localBase}${arabic ? '/ar' : ''}${path}`);
  const diff = ((local.height - original.height) / original.height) * 100;
  const notes = [local.overflow && 'OVERFLOW', local.errors.length && `${local.errors.length} console error(s): ${local.errors[0]}`].filter(Boolean).join(' · ');
  console.log(key.padEnd(30), String(original.height).padStart(9), String(local.height).padStart(9), `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`.padStart(7), '', notes);
}
await browser.close();
