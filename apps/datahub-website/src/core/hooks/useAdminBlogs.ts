import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { blogsApi } from '@/core/api/blogs';
import type { AdminBlogListParams, BlogDetail, BlogWriteBody } from '@/core/types/blog';
import type { BlogStatus } from '@/core/types/enums/blogStatus';
import { HttpError } from '@/core/helpers/http';
import { blogKeys } from './useBlogs';

/*
 * Layer 3 — Blogs Admin hooks (Bearer token).
 * rowVersion: the editor saves with the version it loaded, so someone else's change is reported (409), never
 * overwritten or retried. List actions read the post's current version first (the list has none). After every change
 * the admin queries and the public blog are invalidated.
 */

export const adminBlogKeys = {
  all: ['admin-blogs'] as const,
  lists: () => [...adminBlogKeys.all, 'list'] as const,
  list: (params: AdminBlogListParams) => [...adminBlogKeys.lists(), params] as const,
  detail: (id: string) => [...adminBlogKeys.all, 'detail', id] as const,
};

/* Errors the screens react to. */
const isStatus = (error: unknown, status: number) => error instanceof HttpError && error.status === status;
const isCode = (error: unknown, code: string) => error instanceof HttpError && error.code === code;
export const isBlogConflict = (error: unknown) => isCode(error, 'Cms.ConcurrencyConflict');
export const isDuplicateSlug = (error: unknown) => isCode(error, 'Cms.DuplicateSlug');
export const isInvalidTaxonomy = (error: unknown) => isCode(error, 'Cms.InvalidTaxonomy');
export const isAdminBlogNotFound = (error: unknown) => isStatus(error, 404);
export const isSignInRequired = (error: unknown) => isStatus(error, 401);
export const isForbidden = (error: unknown) => isStatus(error, 403);
export const isNetworkError = (error: unknown) => isStatus(error, 0);
/** Field messages of a 400 answer, e.g. `'Title' must not be empty.` */
export const validationErrorsOf = (error: unknown) => (error instanceof HttpError && error.status === 400 ? error.errors : []);

/** The content was saved, but publishing / unpublishing it afterwards failed. */
export class BlogStatusNotChangedError extends Error {
  readonly id: string;
  readonly status: BlogStatus;
  constructor(id: string, status: BlogStatus, cause: unknown) {
    super('The post was saved, but its status could not be changed.', { cause });
    this.name = 'BlogStatusNotChangedError';
    this.id = id;
    this.status = status;
  }
}

export function useAdminBlogs(params: AdminBlogListParams) {
  return useQuery({
    queryKey: adminBlogKeys.list(params),
    queryFn: ({ signal }) => blogsApi.getAdminBlogs(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/**
 * The image collection of the editor: the featured images already used by posts (every page of the admin list, each
 * image once, with the title of the first post using it). Loaded only while `enabled` (the picker is open).
 */
export function useBlogImageLibrary(enabled: boolean) {
  return useQuery({
    queryKey: [...adminBlogKeys.all, 'images'] as const,
    queryFn: async ({ signal }) => {
      const images = new Map<string, string>();
      for (let pageNumber = 1; ; pageNumber++) {
        const page = await blogsApi.getAdminBlogs({ pageNumber, pageSize: 100 }, signal);
        for (const post of page.items) if (post.featuredImageUrl && !images.has(post.featuredImageUrl)) images.set(post.featuredImageUrl, post.title);
        if (pageNumber >= page.totalPages) break;
      }
      return [...images].map(([url, title]) => ({ url, title }));
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** One post with its current `rowVersion` (always re-read when opened). */
export function useAdminBlog(id: string | undefined) {
  return useQuery({
    queryKey: adminBlogKeys.detail(id ?? ''),
    queryFn: ({ signal }) => blogsApi.getAdminBlog(id ?? '', signal),
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** The post's current version, from the backend (never the cache). */
const fetchLatest = (queryClient: QueryClient, id: string): Promise<BlogDetail> =>
  queryClient.fetchQuery({ queryKey: adminBlogKeys.detail(id), queryFn: ({ signal }) => blogsApi.getAdminBlog(id, signal), staleTime: 0 });

const changeStatus = (id: string, rowVersion: string, status: BlogStatus) =>
  status === 'Published' ? blogsApi.publishBlog(id, rowVersion) : blogsApi.unpublishBlog(id, rowVersion);

const invalidateAll = (queryClient: QueryClient) =>
  Promise.all([queryClient.invalidateQueries({ queryKey: adminBlogKeys.all }), queryClient.invalidateQueries({ queryKey: blogKeys.all })]);

export interface SaveBlogInput {
  body: BlogWriteBody;
  status: BlogStatus;
  /** Editing: the post as loaded. */
  existing?: { id: string; rowVersion: string; status: string };
}

/** Create or update, then publish / unpublish when the chosen status differs (the API creates drafts). */
export function useSaveBlog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, status, existing }: SaveBlogInput) => {
      const id = existing ? existing.id : (await blogsApi.createBlog(body)).id;
      if (existing) await blogsApi.updateBlog(existing.id, existing.rowVersion, body);
      if ((existing?.status ?? 'Draft') !== status) {
        try {
          await changeStatus(id, (await fetchLatest(queryClient, id)).rowVersion, status);
        } catch (cause) {
          throw new BlogStatusNotChangedError(id, status, cause);
        }
      }
      return { id };
    },
    onSettled: () => invalidateAll(queryClient),
  });
}

/** Publish or unpublish; without `rowVersion` the current one is read first. */
export function useSetBlogStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, rowVersion }: { id: string; status: BlogStatus; rowVersion?: string }) =>
      changeStatus(id, rowVersion ?? (await fetchLatest(queryClient, id)).rowVersion, status),
    onSettled: () => invalidateAll(queryClient),
  });
}

/** Delete; without `rowVersion` the current one is read first. */
export function useDeleteBlog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rowVersion }: { id: string; rowVersion?: string }) => blogsApi.deleteBlog(id, rowVersion ?? (await fetchLatest(queryClient, id)).rowVersion),
    onSuccess: (_data, { id }) => queryClient.removeQueries({ queryKey: adminBlogKeys.detail(id) }),
    onSettled: () => invalidateAll(queryClient),
  });
}
