/**
 * Exports every published blog post from the original site's public WordPress REST API.
 *
 * Output:
 *   src/content/blog/index.json         — list metadata (newest first), used by the blog grid
 *   src/content/blog/latest.json        — the 3 newest posts, used by the homepage
 *   src/content/blog/posts/<slug>.json  — sanitized article HTML, loaded lazily by the post page
 *   public/assets/posts/<slug>-card.webp — 370×207 homepage card crop (the original theme's crop)
 *   public/assets/posts/<slug>-grid.webp — 370×230 crop used by the blog index
 *   public/assets/posts/<slug>.webp      — article image, max 1170px wide (the content width)
 *
 * Images are resized to the size they are displayed at and re-encoded as WebP (sharp), which
 * keeps them visually identical while cutting the payload by ~90% versus the original PNG/JPEGs.
 *
 * Usage: node scripts/export-blog.ts [--force-images]
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { decodeEntities, sanitizeHtml } from './lib/sanitize.ts';

const ROOT = join(import.meta.dirname, '..');
const API = 'https://datahubanalytics.com/wp-json/wp/v2/posts';
const CONTENT_DIR = join(ROOT, 'src', 'content', 'blog');
const IMAGE_DIR = join(ROOT, 'public', 'assets', 'posts');
const WEBP = { quality: 82, effort: 5 } as const;
const FORCE_IMAGES = process.argv.includes('--force-images');
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; blog-export/1.0)' };

interface WpMediaSize {
  source_url: string;
  width: number;
  height: number;
}
interface WpPost {
  slug: string;
  date: string;
  modified: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  _embedded?: {
    'wp:featuredmedia'?: Array<{ source_url: string; alt_text: string; media_details?: { width: number; height: number; sizes?: Record<string, WpMediaSize> } }>;
    'wp:term'?: Array<Array<{ name: string; taxonomy: string }>>;
    author?: Array<{ name: string }>;
  };
}

export interface BlogPostSummary {
  slug: string;
  title: string;
  date: string;
  modified: string;
  excerpt: string;
  author: string;
  categories: string[];
  tags: string[];
  image: { card: string; grid: string; large: string; alt: string; width: number; height: number } | null;
}

/* ------------------------------------------------------------------ helpers */

/** Image file name for a slug; some original slugs are too long for Windows paths. */
const fileBase = (slug: string) => (slug.length <= 80 ? slug : `${slug.slice(0, 60)}-${createHash('sha1').update(slug).digest('hex').slice(0, 8)}`);

const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Blog bodies: shared allowlist sanitizer + site-absolute links → internal paths. */
const sanitize = (html: string) =>
  sanitizeHtml(html, { localLink: (href) => href.replace(/^https:\/\/datahubanalytics\.com(\/(?!wp-content))/, '$1') });

async function fetchJson<T>(url: string): Promise<{ data: T; totalPages: number }> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return { data: (await res.json()) as T, totalPages: Number(res.headers.get('x-wp-totalpages') ?? 1) };
}

/** Downloads the first available source, resizes it and writes WebP. Returns output size or null. */
async function saveImage(sources: Array<string | undefined>, target: string, size: { width: number; height?: number }): Promise<{ width: number; height: number } | null> {
  if (!FORCE_IMAGES && existsSync(target)) {
    const meta = await sharp(target).metadata();
    return { width: meta.width ?? size.width, height: meta.height ?? size.height ?? 0 };
  }
  for (const url of sources) {
    if (!url) continue;
    const res = await fetch(encodeURI(decodeURI(url)), { headers: HEADERS });
    if (!res.ok) continue;
    const input = Buffer.from(await res.arrayBuffer());
    const pipeline = sharp(input).resize({ width: size.width, height: size.height, fit: size.height ? 'cover' : 'inside', withoutEnlargement: !size.height });
    const info = await pipeline.webp(WEBP).toFile(target);
    return { width: info.width, height: info.height };
  }
  return null;
}

/* ------------------------------------------------------------------- export */

const posts: WpPost[] = [];
for (let page = 1, total = 1; page <= total; page++) {
  const { data, totalPages } = await fetchJson<WpPost[]>(`${API}?per_page=100&page=${page}&_embed=wp:featuredmedia,wp:term,author&orderby=date&order=desc`);
  posts.push(...data);
  total = totalPages;
  console.log(`Fetched page ${page}/${total} (${posts.length} posts)`);
}

await mkdir(join(CONTENT_DIR, 'posts'), { recursive: true });
await mkdir(IMAGE_DIR, { recursive: true });

const summaries: BlogPostSummary[] = [];
const imageJobs: Array<() => Promise<void>> = [];
const missingImages: string[] = [];

for (const post of posts) {
  const media = post._embedded?.['wp:featuredmedia']?.[0];
  const terms = post._embedded?.['wp:term'] ?? [];
  const byTax = (tax: string) => terms.flat().filter((t) => t.taxonomy === tax).map((t) => decodeEntities(t.name));

  let image: BlogPostSummary['image'] = null;
  if (media?.source_url) {
    const ext = extname(new URL(media.source_url).pathname) || '.jpg';
    const base = media.source_url.slice(0, -ext.length);
    const largeSrc = (media.media_details?.sizes?.large ?? media.media_details?.sizes?.full)?.source_url ?? media.source_url;
    const name = fileBase(post.slug);
    const paths = {
      card: `/assets/posts/${name}-card.webp`,
      grid: `/assets/posts/${name}-grid.webp`,
      large: `/assets/posts/${name}.webp`,
    };
    const entry = { ...paths, alt: decodeEntities(media.alt_text || ''), width: 0, height: 0 };
    image = entry;
    imageJobs.push(async () => {
      // The theme's 370×207 / 370×230 crops exist on the server even though the API doesn't list them.
      const card = await saveImage([`${base}-370x207${ext}`, largeSrc], join(ROOT, 'public', paths.card), { width: 370, height: 207 });
      const grid = await saveImage([`${base}-370x230${ext}`, largeSrc], join(ROOT, 'public', paths.grid), { width: 370, height: 230 });
      const large = await saveImage([largeSrc, media.source_url], join(ROOT, 'public', paths.large), { width: 1170 });
      if (large) Object.assign(entry, large);
      if (!card || !grid || !large) missingImages.push(post.slug);
    });
  }

  const summary: BlogPostSummary = {
    slug: post.slug,
    title: decodeEntities(post.title.rendered),
    date: post.date,
    modified: post.modified,
    excerpt: stripTags(post.excerpt.rendered).replace(/\s*\[…\]\s*$/, ''),
    author: decodeEntities(post._embedded?.author?.[0]?.name ?? ''),
    categories: byTax('category'),
    tags: byTax('post_tag'),
    image,
  };
  summaries.push(summary);
  await writeFile(join(CONTENT_DIR, 'posts', `${post.slug}.json`), JSON.stringify({ slug: post.slug, html: sanitize(post.content.rendered) }) + '\n');
}

// Process images first: their final dimensions are written into the index.
const queue = [...imageJobs];
await Promise.all(Array.from({ length: 6 }, async () => { for (let job = queue.shift(); job; job = queue.shift()) await job(); }));

summaries.sort((a, b) => b.date.localeCompare(a.date));
await writeFile(join(CONTENT_DIR, 'index.json'), JSON.stringify(summaries, null, 1) + '\n');
// The homepage shows the 3 newest posts; a separate file keeps the full index out of its bundle.
await writeFile(join(CONTENT_DIR, 'latest.json'), JSON.stringify(summaries.slice(0, 3), null, 1) + '\n');

console.log(`Exported ${summaries.length} posts.`);
if (missingImages.length) console.warn(`Images missing for ${missingImages.length} posts: ${missingImages.join(', ')}`);
