import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import NavigateNextOutlined from '@mui/icons-material/NavigateNextOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useMatches } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { landingPath, type NavKey } from '@/core/routes/navigation';

/** Route `handle` set by the router for pages that appear in the breadcrumb. */
interface CrumbHandle {
  navKey?: NavKey;
}

/** Home › current page. The separator arrow is mirrored in RTL. */
export function AppBreadcrumbs() {
  const { t } = useTranslation();
  const { canAny } = useAuth();
  const current = [...useMatches()].reverse().find((m) => (m.handle as CrumbHandle | undefined)?.navKey)?.handle as CrumbHandle | undefined;
  if (!current?.navKey) return null;

  return (
    <Breadcrumbs
      aria-label={t('shell.breadcrumb')}
      separator={<NavigateNextOutlined fontSize="small" sx={{ transform: (theme) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) }} />}
      sx={{ mb: 2 }}
    >
      <Link component={RouterLink} to={landingPath(canAny)} underline="hover" color="text.secondary">
        {t('shell.home')}
      </Link>
      <Typography color="text.primary" aria-current="page">
        {t(`nav.items.${current.navKey}`)}
      </Typography>
    </Breadcrumbs>
  );
}
