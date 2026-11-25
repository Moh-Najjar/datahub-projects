import { Suspense, lazy, useEffect, type ComponentType, type ReactNode } from 'react';
import { Navigate, createBrowserRouter, useLocation, type RouteObject } from 'react-router-dom';
import { useAuth } from '@/core/auth/authContext';
import { workspaceActivateUrl } from '@/core/config/workspace';
import type { TrainingPermission } from '@/core/auth/trainingPolicy';
import { BreadcrumbProvider } from '@/core/hooks/BreadcrumbProvider';
import { RedirectIfAuthenticated, RequireAuth } from '@/core/guards/RequireAuth';
import { RequirePermission } from '@/core/guards/RequirePermission';
import { AppLayout } from '@/modules/layout';
import { AccessDeniedPage, NotFoundPage, RouteError } from '@/modules/errors';
import { LoadingState } from '@/modules/shared/states';
import { landingPath } from './navigation';
import { ROUTES } from './paths';

/*
 * THE router — the only place that imports pages from modules. Every page is lazy-loaded into its own chunk.
 * Pages are protected by BUSINESS permission (`RequirePermission`) so a manually typed URL cannot open an
 * unauthorized page; signed-out visitors go to `/login`, which forwards to the DataHub Workspace.
 */

const LoginPage = lazy(() => import('@/modules/auth/LoginPage'));
const SsoPage = lazy(() => import('@/modules/auth/SsoPage'));
const DashboardPage = lazy(() => import('@/modules/dashboard/DashboardPage'));
const TrainingsPage = lazy(() => import('@/modules/trainings/TrainingsPage'));
const TrainingDetailPage = lazy(() => import('@/modules/trainings/TrainingDetailPage'));
const EnrollmentsPage = lazy(() => import('@/modules/enrollments/EnrollmentsPage'));
const UsersPage = lazy(() => import('@/modules/users/UsersPage'));
const DepartmentsPage = lazy(() => import('@/modules/departments/DepartmentsPage'));
const RankingsPage = lazy(() => import('@/modules/rankings/RankingsPage'));
const UserEvaluationsPage = lazy(() => import('@/modules/evaluations/UserEvaluationsPage'));
const CertificatesPage = lazy(() => import('@/modules/certificates/CertificatesPage'));
const CertificatePage = lazy(() => import('@/modules/certificates/CertificatePage'));

const suspended = (Page: ComponentType): ReactNode => (
  <Suspense fallback={<LoadingState />}>
    <Page />
  </Suspense>
);

/** A page that needs ANY of the given business permissions. */
const guarded = (anyOf: readonly TrainingPermission[], Page: ComponentType): ReactNode => (
  <RequirePermission anyOf={anyOf} fallback={<AccessDeniedPage />}>
    {suspended(Page)}
  </RequirePermission>
);

/** `/` → the first page the user's role can open. */
function Landing() {
  const { can } = useAuth();
  return <Navigate to={landingPath(can)} replace />;
}

/** `/login` for signed-in users goes to where they were heading, or to their landing page. */
function LoginRoute() {
  const { can } = useAuth();
  return <RedirectIfAuthenticated fallback={landingPath(can)}>{suspended(LoginPage)}</RedirectIfAuthenticated>;
}

/**
 * `/activate?token=…` — invitation links built with this app's origin. Activation (choosing a password) is the
 * website's page: forward the browser there with the query string unchanged (the token is never read or logged here).
 */
function ActivateForward() {
  const { search } = useLocation();
  const target = workspaceActivateUrl(search);
  useEffect(() => {
    if (target) window.location.replace(target);
  }, [target]);
  return target ? <LoadingState /> : <NotFoundPage />;
}

export const routes: RouteObject[] = [
  { path: ROUTES.activate, element: <ActivateForward /> },
  { path: ROUTES.login, element: <LoginRoute /> },
  { path: ROUTES.sso, element: suspended(SsoPage) },
  {
    path: ROUTES.root,
    element: (
      <RequireAuth>
        <BreadcrumbProvider>
          <AppLayout />
        </BreadcrumbProvider>
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'dashboard', element: guarded(['dashboard.view'], DashboardPage) },
      { path: 'trainings', element: guarded(['trainings.manage', 'trainings.learn'], TrainingsPage) },
      // `:tab` is one of overview | content | assignments | trainees (the page redirects unknown or forbidden tabs).
      { path: 'trainings/:trainingId/:tab?', element: guarded(['trainings.manage', 'trainings.learn'], TrainingDetailPage) },
      { path: 'enrollments', element: guarded(['enrollments.manage'], EnrollmentsPage) },
      { path: 'users', element: guarded(['users.manage'], UsersPage) },
      { path: 'users/:userId/evaluations', element: guarded(['evaluations.manage'], UserEvaluationsPage) },
      { path: 'departments', element: guarded(['departments.manage'], DepartmentsPage) },
      { path: 'rankings', element: guarded(['rankings.view'], RankingsPage) },
      { path: 'certificates', element: guarded(['certificates.view'], CertificatesPage) },
      { path: 'certificates/:enrollmentId', element: guarded(['certificates.view'], CertificatePage) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
