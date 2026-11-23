/**
 * Status values the blog API sends and accepts.
 * A const object, not a TypeScript `enum`: the website compiles with `erasableSyntaxOnly`.
 */
export const BlogStatus = {
  Published: 'Published',
  Draft: 'Draft',
} as const;

export type BlogStatus = (typeof BlogStatus)[keyof typeof BlogStatus];
