import type { BlogPostBody, BlogPostSummary } from '@/modules/blog/types/blog';
import latestSeed from '@/content/blog/latest.json';

/*
 * The initial blog data: posts exported from the original WordPress site (`npm run blog:export`). Read ONLY by the
 * blog service (api/blogApi.ts). The full index (~253 posts) and each article body are separate lazy chunks, so
 * neither the homepage nor the blog grid ships article HTML.
 */

let indexPromise: Promise<BlogPostSummary[]> | undefined;

/** All exported posts, newest first. */
export function loadSeedIndex(): Promise<BlogPostSummary[]> {
  indexPromise ??= import('@/content/blog/index.json').then((m) => m.default as BlogPostSummary[]);
  return indexPromise;
}

const BODIES = import.meta.glob<BlogPostBody>('/src/content/blog/posts/*.json', { import: 'default' });
const bodyCache = new Map<string, Promise<BlogPostBody | null>>();

/** Article HTML of an exported post (by its original slug), or `null` if there is none. */
export function loadSeedBody(slug: string): Promise<BlogPostBody | null> {
  let promise = bodyCache.get(slug);
  if (!promise) {
    const loader = BODIES[`/src/content/blog/posts/${slug}.json`];
    promise = loader ? loader() : Promise.resolve(null);
    bodyCache.set(slug, promise);
  }
  return promise;
}

/** The three newest exported posts, bundled with the homepage (no index download). */
export const LATEST_SEED = latestSeed as BlogPostSummary[];
