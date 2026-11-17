import { LEGACY_REDIRECTS, ROUTES } from '@/core/routes/paths';
import { blogStore, BlogStorageFullError, type BlogStoreState, type StoredPost } from '@/modules/blog/data/blogStore';
import { LATEST_SEED, loadSeedBody, loadSeedIndex } from '@/modules/blog/data/seed';
import type { BlogPost, BlogPostBody, BlogPostInput, BlogPostListItem, BlogPostSummary, BlogStatus } from '@/modules/blog/types/blog';
import { isEmptyHtml, sanitizeHtml } from '@/modules/blog/utils/sanitizeHtml';

/*
 * Blog service — the ONLY place that knows where blog posts come from. Today: the exported posts (data/seed.ts)
 * plus the changes made in the admin, kept in this browser (data/blogStore.ts). To move to a backend, replace the
 * bodies below with REST calls returning the same types; pages and admin screens stay unchanged.
 *
 * Public functions return PUBLISHED posts only. Exported posts are published unless an admin changed that.
 */

export type BlogApiErrorCode = 'not-found' | 'validation' | 'storage-full';

export class BlogApiError extends Error {
  readonly code: BlogApiErrorCode;
  /** Form field the error belongs to (validation errors). */
  readonly field?: keyof BlogPostInput;
  /** Machine-readable reason, e.g. `slugTaken`. */
  readonly reason?: string;

  constructor(code: BlogApiErrorCode, field?: keyof BlogPostInput, reason?: string) {
    super(reason ?? code);
    this.name = 'BlogApiError';
    this.code = code;
    this.field = field;
    this.reason = reason;
  }
}

/* Merging the exported posts with local changes --------------------------------------------------------- */

function summaryOf(p: StoredPost): BlogPostSummary {
  return {
    slug: p.slug,
    title: p.title,
    date: p.date,
    modified: p.modified,
    excerpt: p.excerpt,
    author: p.author,
    categories: p.categories,
    tags: p.tags,
    // One stored image serves the card, the grid and the article (the cards crop it to their usual ratio).
    image: p.cover ? { card: p.cover.src, grid: p.cover.src, large: p.cover.src, alt: p.cover.alt, width: p.cover.width, height: p.cover.height } : null,
  };
}

const newestFirst = (a: BlogPostListItem, b: BlogPostListItem) => b.summary.date.localeCompare(a.summary.date) || a.summary.slug.localeCompare(b.summary.slug);

function mergeSeed(seed: readonly BlogPostSummary[], s: BlogStoreState): BlogPostListItem[] {
  const deleted = new Set(s.deleted);
  const items: BlogPostListItem[] = seed
    .filter((p) => !deleted.has(p.slug) && !s.posts[p.slug])
    .map((p) => ({ id: p.slug, status: s.status[p.slug] ?? 'published', summary: p }));
  for (const p of Object.values(s.posts)) items.push({ id: p.id, status: p.status, summary: summaryOf(p) });
  return items.sort(newestFirst);
}

async function allItems(): Promise<BlogPostListItem[]> {
  return mergeSeed(await loadSeedIndex(), blogStore.read());
}

async function htmlOf(id: string): Promise<string | null> {
  const stored = blogStore.read().posts[id];
  if (stored) return sanitizeHtml(stored.html);
  return (await loadSeedBody(id))?.html ?? null;
}

/* Public website ------------------------------------------------------------------------------------------ */

/** Published posts, newest first. */
export async function getPublishedPosts(): Promise<BlogPostSummary[]> {
  return (await allItems()).filter((p) => p.status === 'published').map((p) => p.summary);
}

/** Article of a published post by slug, or `null` (unknown, deleted or draft). */
export async function getPublishedPostBody(slug: string): Promise<BlogPostBody | null> {
  const item = (await allItems()).find((p) => p.summary.slug === slug && p.status === 'published');
  if (!item) return null;
  const html = await htmlOf(item.id);
  return html === null ? null : { slug, html };
}

/**
 * The `count` newest published posts WITHOUT downloading the full index, when that is possible: the bundled newest
 * exported posts are still the newest unless an admin deleted, unpublished or edited one of them. Returns `null`
 * when the full index is needed (then use `getPublishedPosts`).
 */
export function getLatestPublishedPostsNow(count: number): BlogPostSummary[] | null {
  const s = blogStore.read();
  if (blogStore.isPristine()) return LATEST_SEED.slice(0, count);
  const merged = mergeSeed(LATEST_SEED, s);
  const seedIntact = LATEST_SEED.every((p) => merged.some((m) => m.id === p.slug && m.status === 'published'));
  if (!seedIntact || LATEST_SEED.length < count) return null;
  return merged.filter((p) => p.status === 'published').slice(0, count).map((p) => p.summary);
}

/* Admin ------------------------------------------------------------------------------------------------------ */

/** Every post (published and drafts), newest first. */
export async function getAllPosts(): Promise<BlogPostListItem[]> {
  return allItems();
}

export async function getPostById(id: string): Promise<BlogPost> {
  const item = (await allItems()).find((p) => p.id === id);
  if (!item) throw new BlogApiError('not-found');
  return { ...item, html: (await htmlOf(id)) ?? '' };
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Posts live at `/<slug>/`, so a slug must not be the first segment of a site URL. */
const RESERVED_SLUGS = new Set([
  ...[...Object.values(ROUTES), ...Object.keys(LEGACY_REDIRECTS)].map((path) => path.split('/').filter(Boolean)[0] ?? '').filter(Boolean),
  'ar',
  'admin',
  'assets',
]);

async function validate(input: BlogPostInput, id?: string): Promise<BlogPostInput> {
  const fail = (field: keyof BlogPostInput, reason: string): never => {
    throw new BlogApiError('validation', field, reason);
  };
  const title = input.title.trim();
  const slug = input.slug.trim();
  if (!title) fail('title', 'required');
  if (!SLUG_PATTERN.test(slug)) fail('slug', 'slugFormat');
  if (RESERVED_SLUGS.has(slug)) fail('slug', 'slugReserved');
  if ((await allItems()).some((p) => p.summary.slug === slug && p.id !== id)) fail('slug', 'slugTaken');
  if (!input.excerpt.trim()) fail('excerpt', 'required');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(input.date)) fail('date', 'invalidDate');
  const html = sanitizeHtml(input.html);
  if (isEmptyHtml(html)) fail('html', 'required');
  return {
    ...input,
    title,
    slug,
    excerpt: input.excerpt.trim(),
    author: input.author.trim(),
    categories: [...new Set(input.categories.map((c) => c.trim()).filter(Boolean))],
    tags: [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))],
    html,
  };
}

function save(next: BlogStoreState) {
  try {
    blogStore.write(next);
  } catch (error) {
    if (error instanceof BlogStorageFullError) throw new BlogApiError('storage-full');
    throw error;
  }
}

const nowIso = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

function toStored(id: string, v: BlogPostInput): StoredPost {
  return { id, status: v.status, slug: v.slug, title: v.title, excerpt: v.excerpt, author: v.author, categories: v.categories, tags: v.tags, date: v.date, modified: nowIso(), cover: v.cover, html: v.html };
}

export async function createPost(input: BlogPostInput): Promise<BlogPost> {
  const v = await validate(input);
  const id = `post-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const s = blogStore.read();
  save({ ...s, posts: { ...s.posts, [id]: toStored(id, v) } });
  return getPostById(id);
}

export async function updatePost(id: string, input: BlogPostInput): Promise<BlogPost> {
  await getPostById(id); // not-found check
  const v = await validate(input, id);
  const s = blogStore.read();
  const status = { ...s.status };
  delete status[id];
  save({ ...s, status, posts: { ...s.posts, [id]: toStored(id, v) } });
  return getPostById(id);
}

export async function deletePost(id: string): Promise<void> {
  const { id: existing } = await getPostById(id);
  const s = blogStore.read();
  const posts = { ...s.posts };
  const status = { ...s.status };
  delete posts[existing];
  delete status[existing];
  const isSeed = (await loadSeedIndex()).some((p) => p.slug === existing);
  save({ posts, status, deleted: isSeed ? [...new Set([...s.deleted, existing])] : s.deleted });
}

export async function setPostStatus(id: string, status: BlogStatus): Promise<void> {
  await getPostById(id);
  const s = blogStore.read();
  const stored = s.posts[id];
  if (stored) save({ ...s, posts: { ...s.posts, [id]: { ...stored, status, modified: nowIso() } } });
  else save({ ...s, status: { ...s.status, [id]: status } });
}

/** Cover images of the exported posts, offered as a library in the admin. */
export async function getCoverLibrary(): Promise<Array<{ thumbnail: string; src: string; alt: string; width: number; height: number }>> {
  const seen = new Set<string>();
  const covers = [];
  for (const p of await loadSeedIndex()) {
    if (!p.image || seen.has(p.image.large)) continue;
    seen.add(p.image.large);
    covers.push({ thumbnail: p.image.card, src: p.image.large, alt: p.image.alt || p.title, width: p.image.width, height: p.image.height });
  }
  return covers;
}

/** Categories and tags already in use (suggestions in the admin form). */
export async function getTaxonomy(): Promise<{ categories: string[]; tags: string[] }> {
  const categories = new Set<string>();
  const tags = new Set<string>();
  for (const { summary } of await allItems()) {
    summary.categories.forEach((c) => categories.add(c));
    summary.tags.forEach((t) => tags.add(t));
  }
  const sorted = (set: Set<string>) => [...set].sort((a, b) => a.localeCompare(b));
  return { categories: sorted(categories), tags: sorted(tags) };
}

/** Subscribe to blog changes (this tab or another). */
export const subscribeToBlog = blogStore.subscribe;
export const blogVersion = blogStore.version;
