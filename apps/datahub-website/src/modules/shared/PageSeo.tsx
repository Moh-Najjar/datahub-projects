import { ROUTES, type RouteKey } from '@/core/routes/paths';
import { PAGES } from '@/core/config/pages';
import { useLocale } from '@/i18n/LocaleContext';
import { Seo } from './Seo';

/** Metadata for a registered page, using the original site's title/description per locale. */
export function PageSeo({ routeKey }: { routeKey: RouteKey }) {
  const { locale } = useLocale();
  const page = PAGES[routeKey];
  const meta = page.seo[locale] ?? page.seo.en;
  return <Seo title={meta.title} description={meta.description} image={meta.image} path={ROUTES[routeKey]} locales={page.locales} />;
}
