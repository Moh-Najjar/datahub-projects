/** Post metadata exported from the original WordPress site (see scripts/export-blog.ts). */
export interface BlogPostSummary {
  slug: string;
  title: string;
  /** ISO date-time in the site's timezone. */
  date: string;
  modified: string;
  excerpt: string;
  author: string;
  categories: string[];
  tags: string[];
  image: { card: string; grid: string; large: string; alt: string; width: number; height: number } | null;
}

export interface BlogPostBody {
  slug: string;
  /** Sanitized article HTML. */
  html: string;
}

/* Blog management (admin) ------------------------------------------------------------------------------ */

/** Only `published` posts are visible on the public website. */
export type BlogStatus = 'published' | 'draft';

/** A cover image as stored: one source (URL or uploaded data URL) used for the card, grid and article. */
export interface BlogCover {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/** A post row in the admin listing (no article HTML). */
export interface BlogPostListItem {
  /** Stable id: the original slug for exported posts, generated for new ones (slugs can change). */
  id: string;
  status: BlogStatus;
  summary: BlogPostSummary;
}

/** A complete post, as edited in the admin. */
export interface BlogPost extends BlogPostListItem {
  html: string;
}

/** What the admin form sends to create or update a post. */
export interface BlogPostInput {
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  categories: string[];
  tags: string[];
  /** `YYYY-MM-DDTHH:mm:ss`, site time. */
  date: string;
  status: BlogStatus;
  cover: BlogCover | null;
  html: string;
}
