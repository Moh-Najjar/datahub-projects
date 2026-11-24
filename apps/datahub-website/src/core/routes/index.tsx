// Route elements live beside the router export, so fast-refresh's component-only rule does not apply here.
/* oxlint-disable react/only-export-components */
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { ArabicPostRedirect } from '@/modules/blog/ArabicPostRedirect';
import { SiteLayout } from '@/modules/layout/SiteLayout';
import { ADMIN_ENABLED } from '@/core/config/admin';
import { PAGES } from '@/core/config/pages';
import type { RouteHandle } from '@/i18n/useAlternateHref';
import { RouteError } from '@/modules/errors/RouteError';
import { ADMIN_ROUTES, LEGACY_REDIRECTS, ROUTES, WORKSPACE_ROUTES, type RouteKey } from '@/core/routes/paths';
import type { PageHandle } from '@/core/hooks/useRouteKey';

/** A page file loaded only when its route renders. `SiteLayout` supplies the Suspense boundary. */
type LazyPage = LazyExoticComponent<ComponentType>;

const HomePage: LazyPage = lazy(() => import('@/modules/home/HomePage'));

/** Every page without its own component is rendered from its converted WPBakery document. */
const BlockPage: LazyPage = lazy(() => import('@/modules/page-blocks/BlockPage'));

const BlogPostPage: LazyPage = lazy(() => import('@/modules/blog/BlogPostPage'));

const NotFoundPage: LazyPage = lazy(() => import('@/modules/errors/NotFoundPage'));


/** The DataHub Workspace (central staff sign-in + application launcher): its own layout and lazy pages. */
const WorkspaceLayout: LazyPage = lazy(() => import('@/modules/portals/WorkspaceLayout'));
const WorkspaceLoginPage: LazyPage = lazy(() => import('@/modules/portals/WorkspaceLoginPage'));
const WorkspacePage: LazyPage = lazy(() => import('@/modules/portals/WorkspacePage'));
const WorkspaceLogoutPage: LazyPage = lazy(() => import('@/modules/portals/WorkspaceLogoutPage'));
const WorkspaceOpenPage: LazyPage = lazy(() => import('@/modules/portals/WorkspaceOpenPage'));

/** Admin area (blog management): its own layout and lazy pages, never loaded by public pages. */
const AdminLayout: LazyPage = lazy(() => import('@/modules/admin/AdminLayout'));
const AdminBlogsPage: LazyPage = lazy(() => import('@/modules/admin/AdminBlogsPage'));
const AdminBlogEditorPage: LazyPage = lazy(() => import('@/modules/admin/AdminBlogEditorPage'));

/** Pages with dedicated React implementations. */
const DEDICATED_PAGES: Partial<Record<RouteKey, LazyPage>> = {
  home: HomePage,
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

/** `/workspace/…` and `/ar/workspace/…` (outside the site layout and the page catalogue). */
const workspaceRoutes: RouteObject[] = ['', 'ar/'].map((prefix) => ({
  path: `${prefix}${toRelative(WORKSPACE_ROUTES.root)}`,
  errorElement: <RouteError />,
  element: (
    <Suspense fallback={null}>
      <WorkspaceLayout />
    </Suspense>
  ),
  children: [
    { index: true, element: <WorkspacePage /> },
    { path: 'login', element: <WorkspaceLoginPage /> },
    { path: 'logout', element: <WorkspaceLogoutPage /> },
    { path: 'open/:app', element: <WorkspaceOpenPage /> },
    { path: '*', element: <Navigate to={`/${prefix}${toRelative(WORKSPACE_ROUTES.root)}/`} replace /> },
  ],
}));

/**
 * `/admin/…` (Blogs Admin; English only, outside the site layout). The layout guards every page with the Workspace
 * session; the former admin sign-in address forwards to the Workspace sign-in.
 */
const adminRoutes: RouteObject[] = ADMIN_ENABLED
  ? [
      {
        path: toRelative(ADMIN_ROUTES.root),
        errorElement: <RouteError />,
        element: (
          <Suspense fallback={null}>
            <AdminLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to={ADMIN_ROUTES.blogs} replace /> },
          { path: 'login', element: <Navigate to={WORKSPACE_ROUTES.login} replace state={{ from: ADMIN_ROUTES.blogs }} /> },
          { path: 'blogs', element: <AdminBlogsPage /> },
          { path: 'blogs/new', element: <AdminBlogEditorPage /> },
          { path: 'blogs/:postId/edit', element: <AdminBlogEditorPage /> },
          { path: '*', element: <Navigate to={ADMIN_ROUTES.blogs} replace /> },
        ],
      },
    ]
  : [];

const notFound: RouteObject = {
  path: '*',
  element: <NotFoundPage />,
};

export const router = createBrowserRouter([
  ...workspaceRoutes,
  ...adminRoutes,
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
