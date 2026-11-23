/**
 * Link checker: every internal link in the page documents, blog posts and source data must
 * resolve to a route, a legacy redirect, a blog post or a file in `public/`.
 *
 * Blog posts come from the backend API (`VITE_API_URL`, read from the environment or `.env.development`): their slugs
 * and published article HTML are fetched with the public endpoints. Without the API, posts are not checked.
 *
 * Usage: node scripts/check-links.ts
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { apiPaths } from '../src/core/api/paths.ts';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFile(join(ROOT, p), 'utf8');

const routesSrc = await read('src/core/routes/paths.ts');
const routes = new Set([...routesSrc.matchAll(/^\s+\w+: '(\/[^']*)',/gm)].map((m) => m[1]!));
const redirects = new Set([...routesSrc.matchAll(/^\s+'(\/[^']+)': ROUTES\.\w+,/gm)].map((m) => m[1]!));
/** Published posts of the backend: slug + article HTML (public endpoints, enveloped answers). */
async function loadApiPosts(): Promise<Array<{ slug: string; html: string }>> {
  if (!process.env.VITE_API_URL && existsSync(join(ROOT, '.env.development'))) process.loadEnvFile(join(ROOT, '.env.development'));
  const base = process.env.VITE_API_URL?.replace(/\/+$/, '');
  if (!base) {
    console.warn('VITE_API_URL is not set: blog posts are not checked.');
    return [];
  }
  // The backend rate-limits (429, no Retry-After header): one request at a time, waiting longer after each refusal.
  const get = async (path: string): Promise<unknown> => {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(`${base}${path}`, { headers: { Accept: 'application/json' } });
      if (response.status === 429 && attempt < 8) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(60_000, 2_000 * 2 ** attempt)));
        continue;
      }
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return ((await response.json()) as { data: unknown }).data;
    }
  };
  const slugs: string[] = [];
  for (let page = 1; ; page++) {
    const data = (await get(`${apiPaths.blogs.list}?pageNumber=${page}&pageSize=100`)) as { items: Array<{ slug: string }>; totalPages: number };
    slugs.push(...data.items.map((p) => p.slug));
    if (page >= data.totalPages || data.items.length === 0) break;
  }
  const result: Array<{ slug: string; html: string }> = [];
  for (const slug of slugs) {
    result.push({ slug, html: ((await get(apiPaths.blogs.bySlug(slug))) as { contentHtml?: string }).contentHtml ?? '' });
  }
  return result;
}

const apiPosts = await loadApiPosts();
const posts = new Set(apiPosts.map((p) => `/${p.slug}/`));
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
for (const post of apiPosts) scanHtml(`blog/${post.slug}`, post.html);
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
