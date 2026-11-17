import { useCallback, useEffect, useState } from 'react';
import { getAllPosts, subscribeToBlog, type BlogPostListItem } from '@/modules/blog';

interface AdminPostsState {
  posts: BlogPostListItem[];
  isLoading: boolean;
  error: Error | null;
}

/** Every blog post (published and drafts) for the admin list; reloads after each change. */
export function useAdminPosts(): AdminPostsState & { reload: () => void } {
  const [state, setState] = useState<AdminPostsState>({ posts: [], isLoading: true, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      getAllPosts().then(
        (posts) => active && setState({ posts, isLoading: false, error: null }),
        (error: unknown) => active && setState({ posts: [], isLoading: false, error: error instanceof Error ? error : new Error(String(error)) }),
      );
    void load();
    const unsubscribe = subscribeToBlog(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    setAttempt((a) => a + 1);
  }, []);

  return { ...state, reload };
}
