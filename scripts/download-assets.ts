/**
 * Downloads the original site's public assets (see assets.manifest.ts) and the
 * Satoshi web font into `public/`. Idempotent: files that already exist are skipped.
 *
 * Usage: node scripts/download-assets.ts [--force]
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ASSETS, ORIGIN, SATOSHI_CSS_URL, type AssetEntry } from './assets.manifest.ts';

const PUBLIC_DIR = join(import.meta.dirname, '..', 'public');
const FORCE = process.argv.includes('--force');
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; asset-sync/1.0)' };

async function download(entry: AssetEntry): Promise<'skipped' | 'ok'> {
  const target = join(PUBLIC_DIR, entry.dest);
  if (!FORCE && existsSync(target)) return 'skipped';
  const url = entry.src.startsWith('http') ? entry.src : `${ORIGIN}${entry.src}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await res.arrayBuffer()));
  return 'ok';
}

/** Resolves the woff2 URL for each Satoshi weight from the Fontshare CSS API. */
async function satoshiEntries(): Promise<AssetEntry[]> {
  const css = await (await fetch(SATOSHI_CSS_URL, { headers: HEADERS })).text();
  const entries: AssetEntry[] = [];
  for (const block of css.split('@font-face').slice(1)) {
    const woff2 = block.match(/url\('([^']+\.woff2)'\)/)?.[1];
    const weight = block.match(/font-weight:\s*(\d+)/)?.[1];
    const italic = /font-style:\s*italic/.test(block);
    if (woff2 && weight && !italic) {
      entries.push({ src: woff2.startsWith('//') ? `https:${woff2}` : woff2, dest: `fonts/satoshi/Satoshi-${weight}.woff2` });
    }
  }
  return entries;
}

const all = [...ASSETS, ...(await satoshiEntries())];
const failures: string[] = [];
let downloaded = 0;

// Small concurrency pool to be polite to the origin server.
const queue = [...all];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      try {
        if ((await download(entry)) === 'ok') downloaded++;
      } catch (error) {
        failures.push(`${entry.dest}: ${(error as Error).message}`);
      }
    }
  }),
);

console.log(`Assets: ${all.length} total, ${downloaded} downloaded, ${all.length - downloaded - failures.length} already present.`);
if (failures.length) {
  console.error(`Failed (${failures.length}):\n  ${failures.join('\n  ')}`);
  process.exitCode = 1;
}
