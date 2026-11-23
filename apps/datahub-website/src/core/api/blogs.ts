import { apiPaths } from '@/core/api/paths';
import { http } from '@/core/helpers/http';
import type { AdminBlogListParams, BlogDetail, BlogListItem, BlogListParams, BlogTaxonomyItem, BlogWriteBody, PagedResponse } from '@/core/types/blog';

/** Blog requests. Shapes live in `core/types/blog.ts`; status values in `core/types/enums/blogStatus.ts`. */

export const blogsApi = {
  // Public: published posts only.
  getBlogs: (params: BlogListParams, signal?: AbortSignal) => http.get<PagedResponse<BlogListItem>>(apiPaths.blogs.list, { query: { ...params }, signal }),
  getBlog: (slug: string, signal?: AbortSignal) => http.get<BlogDetail>(apiPaths.blogs.bySlug(slug), { signal }),
  /** Every category / tag (the ids create and update send in `categoryIds` / `tagIds`). */
  getCategories: (signal?: AbortSignal) => http.get<BlogTaxonomyItem[]>(apiPaths.blogs.categories, { signal }),
  getTags: (signal?: AbortSignal) => http.get<BlogTaxonomyItem[]>(apiPaths.blogs.tags, { signal }),

  // Admin (Bearer token).
  getAdminBlogs: (params: AdminBlogListParams, signal?: AbortSignal) => http.get<PagedResponse<BlogListItem>>(apiPaths.blogs.admin.list, { query: { ...params }, signal, auth: true }),
  getAdminBlog: (id: string, signal?: AbortSignal) => http.get<BlogDetail>(apiPaths.blogs.admin.byId(id), { signal, auth: true }),
  /** Creates a draft. */
  createBlog: (body: BlogWriteBody) => http.post<{ id: string }>(apiPaths.blogs.admin.list, body, { auth: true }),
  updateBlog: (id: string, rowVersion: string, body: BlogWriteBody) => http.put<void>(apiPaths.blogs.admin.byId(id), { id, rowVersion, ...body }, { auth: true }),
  publishBlog: (id: string, rowVersion: string) => http.post<void>(apiPaths.blogs.admin.publish(id), { rowVersion }, { auth: true }),
  unpublishBlog: (id: string, rowVersion: string) => http.post<void>(apiPaths.blogs.admin.unpublish(id), { rowVersion }, { auth: true }),
  /** Soft delete. */
  deleteBlog: (id: string, rowVersion: string) => http.delete<void>(apiPaths.blogs.admin.byId(id), { rowVersion }, { auth: true }),
};
