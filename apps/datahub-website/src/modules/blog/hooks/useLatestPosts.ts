import { useEffect, useState, useSyncExternalStore } from 'react';
import { blogVersion, getLatestPublishedPostsNow, getPublishedPosts, subscribeToBlog } from '@/modules/blog/api/blogApi';
import type { BlogPostSummary } from '@/modules/blog/types/blog';

/**
 * The newest published posts for the homepage. Normally available immediately (bundled), so the section renders
 * without a loading state; when admin changes affect the newest posts, the full index is loaded instead.
 */
export function useLatestPosts(count: number): BlogPostSummary[] {
  const version = useSyncExternalStore(subscribeToBlog, blogVersion, blogVersion);
  const immediate = getLatestPublishedPostsNow(count);
  const needsIndex = immediate === null;
  const [loaded, setLoaded] = useState<{ version: number; posts: BlogPostSummary[] } | null>(null);

  useEffect(() => {
    if (!needsIndex) return;
    let active = true;
    void getPublishedPosts().then((posts) => active && setLoaded({ version, posts: posts.slice(0, count) }));
    return () => {
      active = false;
    };
  }, [needsIndex, version, count]);

  return immediate ?? (loaded?.version === version ? loaded.posts : []);
}
