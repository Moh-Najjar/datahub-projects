/**
 * Link checker: every internal link in the page documents, blog posts and source data must
 * resolve to a route, a legacy redirect, a blog post or a file in `public/`.
 *
 * Usage: node scripts/check-links.ts
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFile(join(ROOT, p), 'utf8');

const routesSrc = await read('src/core/routes/paths.ts');
const routes = new Set([...routesSrc.matchAll(/^\s+\w+: '(\/[^']*)',/gm)].map((m) => m[1]!));
const redirects = new Set([...routesSrc.matchAll(/^\s+'(\/[^']+)': ROUTES\.\w+,/gm)].map((m) => m[1]!));
const posts = new Set((JSON.parse(await read('src/content/blog/index.json')) as Array<{ slug: string }>).map((p) => `/${p.slug}/`));
const anchors = new Set<string>();

const isKnown = (href: string) => {
  const [pathPart = '', hash] = href.split('#');
  const path = pathPart.split('?')[0]!;
  if (!path) return true; // pure #anchor
  if (/\.\w{2,5}$/.test(path)) return existsSync(join(ROOT, 'public', decodeURIComponent(path)));
  const normal = path.endsWith('/') ? path : `${path}/`;
  const ok = routes.has(normal) || redirects.has(normal) || posts.has(normal);
  if (ok && hash) anchors.add(`${normal}#${hash}`);
  return ok;
};

const problems = new Map<string, Set<string>>();
const report = (source: string, href: string) => {
  if (!problems.has(href)) problems.set(href, new Set());
  problems.get(href)!.add(source);
};

function scanJson(source: string, node: unknown) {
  if (Array.isArray(node)) return node.forEach((n) => scanJson(source, n));
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if ((k === 'href' || k === 'link' || k === 'src' || k === 'svg') && typeof v === 'string' && v.startsWith('/') && !isKnown(v)) report(source, v);
    else if ((k === 'html' || k === 'textHtml') && typeof v === 'string') scanHtml(source, v);
    else if (k === 'backgroundImage' && typeof v === 'string') for (const m of v.matchAll(/url\(([^)]+)\)/g)) if (!isKnown(m[1]!)) report(source, m[1]!);
    else scanJson(source, v);
  }
}

function scanHtml(source: string, html: string) {
  for (const m of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) if (!isKnown(m[1]!)) report(source, m[1]!);
}

for (const file of await readdir(join(ROOT, 'src/content/pages'))) {
  if (file.endsWith('.json')) scanJson(`pages/${file}`, JSON.parse(await read(`src/content/pages/${file}`)));
}
for (const file of await readdir(join(ROOT, 'src/content/blog/posts'))) {
  scanHtml(`blog/${file}`, (JSON.parse(await read(`src/content/blog/posts/${file}`)) as { html: string }).html);
}
for (const file of ['src/core/config/navigation.ts', 'src/modules/home/data/homeContent.ts', 'src/modules/home/data/logos.ts']) {
  const src = await read(file);
  for (const m of src.matchAll(/'(\/(?:assets|fonts)\/[^']+)'/g)) if (!isKnown(m[1]!)) report(file, m[1]!);
}

if (!problems.size) {
  console.log(`All internal links resolve (${routes.size} routes, ${redirects.size} redirects, ${posts.size} posts).`);
} else {
  console.log(`${problems.size} unresolved internal link(s):`);
  for (const [href, sources] of problems) console.log(`  ${href}\n      in ${[...sources].slice(0, 4).join(', ')}${sources.size > 4 ? ` (+${sources.size - 4})` : ''}`);
  process.exitCode = 1;
}
