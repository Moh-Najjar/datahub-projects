import Button from '@mui/material/Button';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import ExploreOffOutlinedIcon from '@mui/icons-material/ExploreOffOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { ROUTES } from '@/core/routes/paths';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/modules/shared/states';

/** The user has no business permission for this page (a typed URL, or a role change). */
export function AccessDeniedPage() {
  const t = useT();
  return (
    <EmptyState
      icon={<BlockOutlinedIcon />}
      title={t.errors.accessDeniedTitle}
      description={t.errors.accessDeniedBody}
      action={
        <Button component={RouterLink} to={ROUTES.root} variant="contained">
          {t.errors.backHome}
        </Button>
      }
    />
  );
}

export function NotFoundPage() {
  const t = useT();
  return (
    <EmptyState
      icon={<ExploreOffOutlinedIcon />}
      title={t.errors.notFoundTitle}
      description={t.errors.notFoundBody}
      action={
        <Button component={RouterLink} to={ROUTES.root} variant="contained">
          {t.errors.backHome}
        </Button>
      }
    />
  );
}

/** Router-level error boundary: an unexpected failure while rendering a page. */
export function RouteError() {
  const t = useT();
  return (
    <EmptyState
      icon={<ReportProblemOutlinedIcon />}
      title={t.errors.unexpectedTitle}
      description={t.errors.unexpectedBody}
      action={
        <Button variant="contained" onClick={() => window.location.reload()}>
          {t.errors.reload}
        </Button>
      }
    />
  );
}
