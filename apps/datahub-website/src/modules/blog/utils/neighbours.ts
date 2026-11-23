import type { BlogListItem } from '@/core/types/blog';

/** The older and newer neighbours of a post in the blog's order (newest first). */
export function neighboursOf(posts: readonly BlogListItem[], slug: string): { older?: BlogListItem; newer?: BlogListItem } {
  const i = posts.findIndex((p) => p.slug === slug);
  return i < 0 ? {} : { newer: posts[i - 1], older: posts[i + 1] };
}
