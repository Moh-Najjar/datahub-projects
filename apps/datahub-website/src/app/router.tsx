import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { ArabicPostRedirect } from '@/pages/Blog/ArabicPostRedirect';
import { SiteLayout } from '@/components/layout/SiteLayout/SiteLayout';
import { PAGES } from '@/shared/config/pages';
import type { RouteHandle } from '@/i18n/useAlternateHref';
import { RouteError } from '@/pages/Errors/RouteError';
import { LEGACY_REDIRECTS, ROUTES, type RouteKey } from '@/shared/config/routes';
import type { PageHandle } from '@/shared/hooks/useRouteKey';

type PageModule = Promise<{ default: ComponentType }>;

/** Pages with dedicated React implementations. */
const PAGE_MODULES: Partial<Record<RouteKey, () => PageModule>> = {
  home: () => import('@/pages/Home/HomePage'),
};

/** Every other page is rendered from its converted WPBakery document. */
const blockPage = () => import('@/pages/BlockPage/BlockPage');

/** `/about-us/` → `about-us` (React Router paths are relative to the parent). */
const toRelative = (path: string) => path.replace(/^\/|\/$/g, '');

function pageRoutes(locale: 'en' | 'ar'): RouteObject[] {
  return (Object.keys(ROUTES) as RouteKey[]).map((key) => {
    const path = toRelative(ROUTES[key]);
    const page = PAGES[key];
    const base = path ? { path } : { index: true as const };

    // Arabic URL of an English-only page → the English page (like the original's menu does).
    if (locale === 'ar' && !page.locales.includes('ar')) {
      return { ...base, element: <Navigate to={ROUTES[key]} replace /> };
    }

    const load = PAGE_MODULES[key] ?? blockPage;
    const handle: PageHandle = { routeKey: key, locales: page.locales };
    return {
      ...base,
      handle,
      lazy: async () => ({ Component: (await load()).default }),
    };
  });
}

const redirectRoutes: RouteObject[] = Object.entries(LEGACY_REDIRECTS).map(([from, to]) => ({
  path: toRelative(from),
  element: <Navigate to={to} replace />,
}));

/** Blog posts live at the site root (`/<slug>/`), like on the original. English only. */
const blogPost: RouteObject = {
  path: ':slug',
  handle: { locales: ['en'] } satisfies RouteHandle,
  lazy: async () => ({ Component: (await import('@/pages/Blog/BlogPostPage')).default }),
};

const notFound: RouteObject = {
  path: '*',
  lazy: async () => ({ Component: (await import('@/pages/Errors/NotFoundPage')).default }),
};

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    errorElement: <RouteError />,
    // Client-rendered app: nothing to show before the first lazy route resolves.
    HydrateFallback: () => null,
    children: [
      ...pageRoutes('en'),
      ...redirectRoutes,
      { path: 'ar', children: [...pageRoutes('ar'), { path: ':slug', element: <ArabicPostRedirect /> }, notFound] },
      blogPost,
      notFound,
    ],
  },
]);
