import type { BlogStatus } from '@/core/types/enums/blogStatus';

/** One row of a blog list. Missing text is `null`, as the API sends it. */
export interface BlogListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  /** UTC; `null` for a draft that was never published. */
  publishedAtUtc: string | null;
  status: BlogStatus;
}

/** A category or tag as a post carries it. */
export interface BlogTerm {
  id: string;
  name: string;
  slug: string;
}

/** A category or tag from `GET /api/blogs/categories` or `GET /api/blogs/tags`. */
export interface BlogTaxonomyItem extends BlogTerm {
  description: string | null;
}

/** A full post, including the HTML and the concurrency token. */
export interface BlogDetail extends BlogListItem {
  contentHtml: string;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  authorId: string | null;
  authorName: string | null;
  categories: BlogTerm[];
  tags: BlogTerm[];
  /** Send it with every change: a stale one is refused (409 `Cms.ConcurrencyConflict`). */
  rowVersion: string;
}

/** A paged API answer. */
export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export interface BlogListParams {
  pageNumber: number;
  pageSize: number;
}

export interface AdminBlogListParams extends BlogListParams {
  search?: string;
  status?: BlogStatus;
}

/** Body of create and update. Writes answer 204, so read the post again for the new `rowVersion`. */
export interface BlogWriteBody {
  title: string;
  slug: string;
  excerpt: string | null;
  contentHtml: string;
  featuredImageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  authorId: string | null;
  categoryIds: string[];
  tagIds: string[];
}
