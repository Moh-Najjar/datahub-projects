// Route elements live beside the router export, so fast-refresh's component-only rule does not apply here.
/* oxlint-disable react/only-export-components */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { ArabicPostRedirect } from '@/modules/blog/ArabicPostRedirect';
import { SiteLayout } from '@/modules/layout/SiteLayout';
import { PAGES } from '@/core/config/pages';
import type { RouteHandle } from '@/i18n/useAlternateHref';
import { RouteError } from '@/modules/errors/RouteError';
import { LEGACY_REDIRECTS, ROUTES, type RouteKey } from '@/core/routes/paths';
import type { PageHandle } from '@/core/hooks/useRouteKey';

/** A page file loaded only when its route renders. `SiteLayout` supplies the Suspense boundary. */
type LazyPage = LazyExoticComponent<ComponentType>;

const HomePage: LazyPage = lazy(() => import('@/modules/home/HomePage'));

/** Every page without its own component is rendered from its converted WPBakery document. */
const BlockPage: LazyPage = lazy(() => import('@/modules/page-blocks/BlockPage'));

const BlogPostPage: LazyPage = lazy(() => import('@/modules/blog/BlogPostPage'));

const NotFoundPage: LazyPage = lazy(() => import('@/modules/errors/NotFoundPage'));

const ProductsPage: LazyPage = lazy(() => import('@/modules/products/ProductsPage'));

/** Pages with dedicated React implementations. */
const DEDICATED_PAGES: Partial<Record<RouteKey, LazyPage>> = {
  home: HomePage,
  products: ProductsPage,
};

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

    const Page = DEDICATED_PAGES[key] ?? BlockPage;
    const handle: PageHandle = { routeKey: key, locales: page.locales };
    return { ...base, handle, element: <Page /> };
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
  element: <BlogPostPage />,
};

const notFound: RouteObject = {
  path: '*',
  element: <NotFoundPage />,
};

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    errorElement: <RouteError />,
    children: [
      ...pageRoutes('en'),
      ...redirectRoutes,
      { path: 'ar', children: [...pageRoutes('ar'), { path: ':slug', element: <ArabicPostRedirect /> }, notFound] },
      blogPost,
      notFound,
    ],
  },
]);
