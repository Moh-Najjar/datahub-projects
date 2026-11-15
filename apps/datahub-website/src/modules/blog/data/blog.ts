import type { BlogPostBody, BlogPostSummary } from '@/features/blog/types/blog';

/*
 * Blog data access. The full index (~253 posts) and each article body are separate
 * lazy chunks, so neither the homepage nor the blog grid ships article HTML.
 */

let indexPromise: Promise<BlogPostSummary[]> | undefined;

/** All posts, newest first. */
export function loadBlogIndex(): Promise<BlogPostSummary[]> {
  indexPromise ??= import('@/content/blog/index.json').then((m) => m.default as BlogPostSummary[]);
  return indexPromise;
}

const BODIES = import.meta.glob<BlogPostBody>('/src/content/blog/posts/*.json', { import: 'default' });
const bodyCache = new Map<string, Promise<BlogPostBody | null>>();

/** Sanitized article HTML for a post, or `null` if the slug doesn't exist. */
export function loadBlogBody(slug: string): Promise<BlogPostBody | null> {
  let promise = bodyCache.get(slug);
  if (!promise) {
    const loader = BODIES[`/src/content/blog/posts/${slug}.json`];
    promise = loader ? loader() : Promise.resolve(null);
    bodyCache.set(slug, promise);
  }
  return promise;
}

export const BLOG_PAGE_SIZE = 10;
