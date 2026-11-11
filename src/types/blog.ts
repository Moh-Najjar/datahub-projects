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
