import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Navigate, useLocation } from 'react-router-dom';
import { WORKSPACE_ROUTES } from '@/core/routes/paths';
import { fill, UI } from '@/i18n';
import { useLocale } from '@/i18n/LocaleContext';
import { localizePath } from '@/i18n/paths';
import { ApplicationCard } from '@/modules/portals/components/ApplicationCard';
import { WorkspaceHeader } from '@/modules/portals/components/WorkspaceHeader';
import { applicationsFor } from '@/modules/portals/data/applications';
import { useWorkspaceSession } from '@/modules/portals/hooks/useWorkspaceSession';
import type { WorkspaceLocationState } from '@/modules/portals/types';

/** `/workspace/` — the application launcher: one card per application the signed-in role may open. */
export default function WorkspacePage() {
  const { locale } = useLocale();
  const t = UI[locale].workspace;
  const session = useWorkspaceSession();
  const location = useLocation();
  const state = (location.state ?? null) as WorkspaceLocationState | null;

  if (!session) {
    return <Navigate to={localizePath(WORKSPACE_ROUTES.login, locale)} replace state={{ from: location.pathname } satisfies WorkspaceLocationState} />;
  }
  const apps = applicationsFor(session.role);

  return (
    <>
      <title>{fill(t.pageTitle, { page: t.home.title })}</title>
      <WorkspaceHeader session={session} />
      <Box component="main" sx={{ maxWidth: 1240, mx: 'auto', px: { xs: '15px', md: '30px' }, py: { xs: '28px', md: '48px' } }}>
        <Typography variant="h1" sx={{ fontSize: { xs: 28, md: 34 } }}>
          {t.home.title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: '8px', mb: '28px' }}>
          {fill(t.home.subtitle, { role: t.roles[session.role] })}
        </Typography>
        {state?.denied && (
          <Alert severity="warning" sx={{ mb: '24px' }}>
            {fill(t.home.accessDenied, { app: t.apps[state.denied].name })}
          </Alert>
        )}
        {apps.length > 0 ? (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}>
            {apps.map((app) => (
              <li key={app}>
                <ApplicationCard app={app} />
              </li>
            ))}
          </Box>
        ) : (
          <Alert severity="info">{t.home.empty}</Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: '32px', fontSize: 13 }}>
          {t.home.sessionNote}
        </Typography>
      </Box>
    </>
  );
}
