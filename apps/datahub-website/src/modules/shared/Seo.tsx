import { useLocale } from '@/i18n/LocaleContext';
import { localizePath } from '@/i18n/paths';
import type { Locale } from '@/i18n/languages';

export const SITE_URL = 'https://datahubanalytics.com';
const SITE_NAME = 'Datahub Analytics';

interface SeoProps {
  title: string;
  description?: string;
  /** Locale-neutral canonical path (e.g. `/about-us/`). */
  path: string;
  image?: string;
  type?: 'website' | 'article';
  /** Locales the page exists in — controls `hreflang` alternates. */
  locales?: readonly Locale[];
  /** Absolute canonical URL set by the content (e.g. a blog post's `canonicalUrl`); overrides the one built from `path`. */
  canonicalUrl?: string;
}

const OG_LOCALE: Record<Locale, string> = { en: 'en_US', ar: 'ar' };

/**
 * Page metadata. React 19 hoists `<title>`, `<meta>` and `<link>` into `<head>`.
 */
export function Seo({ title, description, path, image, type = 'website', locales = ['en', 'ar'], canonicalUrl }: SeoProps) {
  const { locale } = useLocale();
  const url = canonicalUrl && /^https?:\/\//.test(canonicalUrl) ? canonicalUrl : `${SITE_URL}${localizePath(path, locale)}`;
  const imageUrl = image ? (image.startsWith('http') ? image : `${SITE_URL}${image}`) : undefined;

  return (
    <>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      {locales.map((l) => (
        <link key={l} rel="alternate" hrefLang={l} href={`${SITE_URL}${localizePath(path, l)}`} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}${path}`} />
      <meta property="og:locale" content={OG_LOCALE[locale]} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={SITE_NAME} />
      {imageUrl && <meta property="og:image" content={imageUrl} />}
      <meta name="twitter:card" content="summary_large_image" />
    </>
  );
}
