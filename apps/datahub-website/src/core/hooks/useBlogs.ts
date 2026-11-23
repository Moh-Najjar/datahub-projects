import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { blogsApi } from '@/core/api/blogs';
import type { BlogListItem, BlogListParams } from '@/core/types/blog';
import { HttpError } from '@/core/helpers/http';

/* Layer 3 — public blog hooks. Every key starts with `blogKeys.all`, so one invalidation refreshes the public blog. */

export const blogKeys = {
  all: ['blogs'] as const,
  list: (params: BlogListParams) => [...blogKeys.all, 'list', params] as const,
  infinite: (pageSize: number) => [...blogKeys.all, 'infinite', pageSize] as const,
  detail: (slug: string) => [...blogKeys.all, 'detail', slug] as const,
  categories: () => [...blogKeys.all, 'categories'] as const,
  tags: () => [...blogKeys.all, 'tags'] as const,
  index: () => [...blogKeys.all, 'index'] as const,
};

export const isBlogNotFound = (error: unknown) => error instanceof HttpError && error.status === 404;

/** One page of published posts; the previous page stays visible while the next one loads. */
export function useBlogs(params: BlogListParams) {
  return useQuery({
    queryKey: blogKeys.list(params),
    queryFn: ({ signal }) => blogsApi.getBlogs(params, signal),
    placeholderData: keepPreviousData,
  });
}

/** Published posts, page after page (infinite loading). */
export function useInfiniteBlogs(pageSize: number) {
  return useInfiniteQuery({
    queryKey: blogKeys.infinite(pageSize),
    queryFn: ({ pageParam, signal }) => blogsApi.getBlogs({ pageNumber: pageParam, pageSize }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pageNumber < last.totalPages ? last.pageNumber + 1 : undefined),
  });
}

/** One published post by slug (404 for unknown slugs and drafts). */
export function useBlog(slug: string) {
  return useQuery({
    queryKey: blogKeys.detail(slug),
    queryFn: ({ signal }) => blogsApi.getBlog(slug, signal),
  });
}

/** Every blog category (`GET /api/blogs/categories`). */
export function useBlogCategories() {
  return useQuery({ queryKey: blogKeys.categories(), queryFn: ({ signal }) => blogsApi.getCategories(signal) });
}

/** Every blog tag (`GET /api/blogs/tags`). */
export function useBlogTags() {
  return useQuery({ queryKey: blogKeys.tags(), queryFn: ({ signal }) => blogsApi.getTags(signal) });
}

/**
 * Every published post, in the API's order (newest first): pages of 100, cached and shared — used to find a post's
 * neighbours (the previous / next post links). Light: list items only, no article HTML.
 */
export function useBlogIndex() {
  return useQuery({
    queryKey: blogKeys.index(),
    queryFn: async ({ signal }) => {
      const posts: BlogListItem[] = [];
      for (let pageNumber = 1; ; pageNumber++) {
        const page = await blogsApi.getBlogs({ pageNumber, pageSize: 100 }, signal);
        posts.push(...page.items);
        if (pageNumber >= page.totalPages) return posts;
      }
    },
  });
}
