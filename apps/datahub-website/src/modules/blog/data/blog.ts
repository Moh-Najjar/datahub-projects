import { blogVersion, getPublishedPostBody, getPublishedPosts } from '@/modules/blog/api/blogApi';
import type { BlogPostBody, BlogPostSummary } from '@/modules/blog/types/blog';

/*
 * Cached readers for the public blog pages (React 19 `use()` needs the same promise across renders). They read
 * PUBLISHED posts through the blog service; the cache is dropped whenever the blog changes (admin, other tab),
 * so the next page that renders gets fresh data.
 */

let cache: { version: number; index?: Promise<BlogPostSummary[]>; bodies: Map<string, Promise<BlogPostBody | null>> } = { version: -1, bodies: new Map() };

function current() {
  const version = blogVersion();
  if (cache.version !== version) cache = { version, bodies: new Map() };
  return cache;
}

/** Published posts, newest first. */
export function loadBlogIndex(): Promise<BlogPostSummary[]> {
  const c = current();
  c.index ??= getPublishedPosts();
  return c.index;
}

/** Article HTML of a published post, or `null` if the slug doesn't exist or is a draft. */
export function loadBlogBody(slug: string): Promise<BlogPostBody | null> {
  const c = current();
  let promise = c.bodies.get(slug);
  if (!promise) {
    promise = getPublishedPostBody(slug);
    c.bodies.set(slug, promise);
  }
  return promise;
}

export const BLOG_PAGE_SIZE = 10;
