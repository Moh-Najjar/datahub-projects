// Route elements live beside the router export, so fast-refresh's component-only rule does not apply here.
/* oxlint-disable react/only-export-components */
import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { RedirectIfAuthenticated, RequireAuth } from '@/core/guards/RequireAuth';
import { RequirePermission } from '@/core/guards/RequirePermission';
import { landingPath, navItem, type NavKey } from '@/core/routes/navigation';
import { RouteError } from '@/modules/errors/RouteError';
import { AppLayout } from '@/modules/layout/AppLayout';

/*
 * The router. Guards here only decide what the UI renders — the backend must enforce authentication and
 * authorization on every request. Each page is lazy-loaded into its own chunk.
 */

type LazyPage = LazyExoticComponent<ComponentType>;

const LoginPage: LazyPage = lazy(() => import('@/modules/auth/LoginPage'));
const ProfilePage: LazyPage = lazy(() => import('@/modules/auth/ProfilePage'));
const DashboardPage: LazyPage = lazy(() => import('@/modules/dashboard/DashboardPage'));
const AccessDeniedPage: LazyPage = lazy(() => import('@/modules/errors/AccessDeniedPage'));
const NotFoundPage: LazyPage = lazy(() => import('@/modules/errors/NotFoundPage'));

const page = (Page: LazyPage): ReactNode => (
  <Suspense fallback={null}>
    <Page />
  </Suspense>
);

/** A signed-in page from the navigation map: breadcrumb + permission guard (access denied otherwise). */
function navRoute(key: NavKey, Page: LazyPage): RouteObject {
  const item = navItem(key);
  return {
    path: item.path.slice(1),
    handle: { navKey: key },
    element: (
      <RequirePermission anyOf={item.anyOf} fallback={page(AccessDeniedPage)}>
        {page(Page)}
      </RequirePermission>
    ),
  };
}

/** `/` and post-sign-in: the first page the role may open. */
function LandingRedirect() {
  const { canAny } = useAuth();
  return <Navigate to={landingPath(canAny)} replace />;
}

function LoginRoute() {
  const { canAny } = useAuth();
  return <RedirectIfAuthenticated fallback={landingPath(canAny)}>{page(LoginPage)}</RedirectIfAuthenticated>;
}

export const routes: RouteObject[] = [
  {
    element: <Outlet />,
    errorElement: <RouteError />,
    children: [
      { path: 'login', element: <LoginRoute /> },
      {
        element: (
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <LandingRedirect /> },
          navRoute('dashboard', DashboardPage),
          navRoute('profile', ProfilePage),
          { path: '*', element: page(NotFoundPage) },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
