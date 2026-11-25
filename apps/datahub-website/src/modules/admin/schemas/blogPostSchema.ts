import { z } from 'zod';
import type { BlogDetail, BlogWriteBody } from '@/core/types/blog';
import { BlogStatus } from '@/core/types/enums/blogStatus';
import { LEGACY_REDIRECTS, ROUTES } from '@/core/routes/paths';
import { isEmptyHtml, sanitizeHtml } from '@/modules/blog';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';

const v = ADMIN_TEXT.validation;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Posts live at `/<slug>/`, so a slug must not be the first segment of a site URL. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...[...Object.values(ROUTES), ...Object.keys(LEGACY_REDIRECTS)].map((path) => path.split('/').filter(Boolean)[0] ?? '').filter(Boolean),
  'ar',
  'admin',
  'workspace',
  'activate',
  'assets',
  'api',
  // `/api/blogs/tags` and `/api/blogs/categories` are the backend's lists, not posts.
  'tags',
  'categories',
]);

const optionalHttpsUrl = (max: number) =>
  z
    .string()
    .trim()
    .max(max, v.tooLong(max))
    .refine((value) => value === '' || /^https:\/\/\S+$/i.test(value), v.httpsUrl);

/**
 * The blog post form — exactly the fields the backend stores. Categories and tags are chosen from the backend's lists
 * (their ids are sent). Authors are not in the form: the backend has no list of authors yet (`authorId` is `null`). The
 * backend re-validates everything (slug uniqueness, unknown category / tag ids) when saving; its answers are shown.
 */
export const blogPostSchema = z.object({
  title: z.string().trim().min(1, v.titleRequired).max(200, v.tooLong(200)),
  slug: z
    .string()
    .trim()
    .max(120, v.tooLong(120))
    .regex(SLUG_PATTERN, v.slugFormat)
    .refine((slug) => !RESERVED_SLUGS.has(slug), v.slugReserved),
  excerpt: z.string().trim().max(500, v.tooLong(500)),
  html: z.string().refine((html) => !isEmptyHtml(html), v.contentRequired),
  status: z.enum([BlogStatus.Published, BlogStatus.Draft]),
  featuredImageUrl: optionalHttpsUrl(2048),
  metaTitle: z.string().trim().max(200, v.tooLong(200)),
  metaDescription: z.string().trim().max(500, v.tooLong(500)),
  canonicalUrl: optionalHttpsUrl(2048),
  categoryIds: z.array(z.string()),
  tagIds: z.array(z.string()),
});

export type BlogPostFormValues = z.infer<typeof blogPostSchema>;

export function emptyFormValues(): BlogPostFormValues {
  return { title: '', slug: '', excerpt: '', html: '', status: BlogStatus.Draft, featuredImageUrl: '', metaTitle: '', metaDescription: '', canonicalUrl: '', categoryIds: [], tagIds: [] };
}

export const toStatus = (status: string): BlogStatus => (status.toLowerCase() === 'published' ? BlogStatus.Published : BlogStatus.Draft);

export function toFormValues(post: BlogDetail): BlogPostFormValues {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? '',
    html: post.contentHtml,
    status: toStatus(post.status),
    featuredImageUrl: post.featuredImageUrl ?? '',
    metaTitle: post.metaTitle ?? '',
    metaDescription: post.metaDescription ?? '',
    canonicalUrl: post.canonicalUrl ?? '',
    categoryIds: post.categories.map((c) => c.id),
    tagIds: post.tags.map((t) => t.id),
  };
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);

/** Form values → the backend's create / update body (sanitized article HTML, empty fields as `null`). */
export function toWriteBody(values: BlogPostFormValues): BlogWriteBody {
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    excerpt: orNull(values.excerpt),
    contentHtml: sanitizeHtml(values.html),
    featuredImageUrl: orNull(values.featuredImageUrl),
    metaTitle: orNull(values.metaTitle),
    metaDescription: orNull(values.metaDescription),
    canonicalUrl: orNull(values.canonicalUrl),
    authorId: null,
    categoryIds: values.categoryIds,
    tagIds: values.tagIds,
  };
}

/** Backend validation names (`'Content Html' must not be empty.`) → form fields. */
const FIELD_BY_API_NAME: Record<string, keyof BlogPostFormValues> = {
  title: 'title',
  slug: 'slug',
  excerpt: 'excerpt',
  contenthtml: 'html',
  featuredimageurl: 'featuredImageUrl',
  metatitle: 'metaTitle',
  metadescription: 'metaDescription',
  canonicalurl: 'canonicalUrl',
  categoryids: 'categoryIds',
  tagids: 'tagIds',
};

/** The form field a backend validation message is about (its quoted property name), if any. */
export function fieldOfApiMessage(description: string): keyof BlogPostFormValues | undefined {
  const name = /'([^']+)'/.exec(description)?.[1];
  return name ? FIELD_BY_API_NAME[name.replace(/\s+/g, '').toLowerCase()] : undefined;
}
