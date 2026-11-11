/**
 * Visual-comparison helper.
 *
 * Captures a page as a series of viewport-sized screenshots ("chunks") so that
 * each image stays legible, after scrolling through the page to trigger lazy
 * loading and scroll animations.
 *
 * Usage:
 *   node scripts/screenshot.ts <url> <outDir> [width=1440] [height=900] [maxChunks=30]
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [url, outDir, widthArg = '1440', heightArg = '900', maxArg = '30'] = process.argv.slice(2);

if (!url || !outDir) {
  console.error('Usage: node scripts/screenshot.ts <url> <outDir> [width] [height] [maxChunks]');
  process.exit(1);
}

const width = Number(widthArg);
const height = Number(heightArg);
const maxChunks = Number(maxArg);

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });

// Scroll through the page to trigger lazy images and reveal animations.
const total = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < total; y += Math.round(height / 2)) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await page.waitForTimeout(250);
}
await page.waitForTimeout(1000);

const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
const chunks = Math.min(Math.ceil(fullHeight / height), maxChunks);

for (let i = 0; i < chunks; i++) {
  await page.evaluate((top) => window.scrollTo(0, top), i * height);
  await page.waitForTimeout(700);
  const file = join(outDir, `${width}-${String(i).padStart(2, '0')}.png`);
  await page.screenshot({ path: file });
}

console.log(`${chunks} chunks (${fullHeight}px tall) → ${outDir}`);
await browser.close();
