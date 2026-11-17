import { z } from 'zod';
import { SLUG_PATTERN, type BlogPost, type BlogPostInput } from '@/modules/blog';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';

const v = ADMIN_TEXT.validation;

/** True when the article HTML has visible text or an image. */
const hasContent = (html: string) => /<img\s/i.test(html) || html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;

/** The blog post form. The blog service re-checks the same rules (and slug uniqueness) when saving. */
export const blogPostSchema = z.object({
  title: z.string().trim().min(1, v.titleRequired).max(200, v.tooLong(200)),
  slug: z.string().trim().max(120, v.tooLong(120)).regex(SLUG_PATTERN, v.slugFormat),
  excerpt: z.string().trim().min(1, v.excerptRequired).max(500, v.tooLong(500)),
  author: z.string().trim().max(100, v.tooLong(100)),
  categories: z.array(z.string()),
  tags: z.array(z.string()),
  /** `datetime-local` value: `YYYY-MM-DDTHH:mm`. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, v.dateRequired),
  status: z.enum(['published', 'draft']),
  cover: z.object({ src: z.string(), alt: z.string().max(200, v.tooLong(200)), width: z.number(), height: z.number() }).nullable(),
  html: z.string().refine(hasContent, v.contentRequired),
});

export type BlogPostFormValues = z.infer<typeof blogPostSchema>;

const pad = (n: number) => String(n).padStart(2, '0');

export function emptyFormValues(): BlogPostFormValues {
  const d = new Date();
  return {
    title: '',
    slug: '',
    excerpt: '',
    author: 'Datahub Analytics Team',
    categories: [],
    tags: [],
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    status: 'draft',
    cover: null,
    html: '',
  };
}

export function toFormValues(post: BlogPost): BlogPostFormValues {
  const s = post.summary;
  return {
    title: s.title,
    slug: s.slug,
    excerpt: s.excerpt,
    author: s.author,
    categories: s.categories,
    tags: s.tags,
    date: s.date.slice(0, 16),
    status: post.status,
    cover: s.image ? { src: s.image.large, alt: s.image.alt, width: s.image.width, height: s.image.height } : null,
    html: post.html,
  };
}

export function toInput(values: BlogPostFormValues): BlogPostInput {
  return { ...values, date: `${values.date}:00` };
}
