import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import NavigateNextOutlined from '@mui/icons-material/NavigateNextOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useMatches } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { useBreadcrumbTrail } from '@/core/context/breadcrumbContext';
import { landingPath, NAV_GROUPS, navItem, type NavKey } from '@/core/routes/navigation';

/** Route `handle` set by the router for pages that appear in the breadcrumb. */
interface CrumbHandle {
  navKey?: NavKey;
}

/** App name › sidebar group › section › (the page's own trail, e.g. an employee's name). The separator is mirrored in RTL. */
export function AppBreadcrumbs() {
  const { t } = useTranslation();
  const { canAny } = useAuth();
  const trail = useBreadcrumbTrail();
  const current = [...useMatches()].reverse().find((m) => (m.handle as CrumbHandle | undefined)?.navKey)?.handle as CrumbHandle | undefined;
  if (!current?.navKey) return null;
  const group = NAV_GROUPS.find((g) => g.items.some((item) => item.key === current.navKey));

  return (
    <Breadcrumbs
      aria-label={t('shell.breadcrumb')}
      separator={<NavigateNextOutlined sx={{ fontSize: 16, color: 'grey.400', transform: (theme) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) }} />}
      sx={{
        minWidth: 0,
        '& .MuiBreadcrumbs-ol': { flexWrap: 'nowrap' },
        '& .MuiBreadcrumbs-li': { minWidth: 0 },
        '& .MuiTypography-root, & .MuiLink-root': {
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: { sm: 160, md: 280, lg: 420 },
          fontSize: 14,
        },
      }}
    >
      <Link component={RouterLink} to={landingPath(canAny)} underline="hover" color="text.secondary">
        {t('appName')}
      </Link>
      {group && (
        <Typography color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
          {t(`nav.groups.${group.key}`)}
        </Typography>
      )}
      {trail.length > 0 ? (
        <Link component={RouterLink} to={navItem(current.navKey).path} underline="hover" color="text.secondary">
          {t(`nav.items.${current.navKey}`)}
        </Link>
      ) : (
        <Typography color="text.primary" aria-current="page" sx={{ fontWeight: 700 }}>
          {t(`nav.items.${current.navKey}`)}
        </Typography>
      )}
      {trail.map((crumb, i) =>
        crumb.to && i < trail.length - 1 ? (
          <Link key={crumb.label} component={RouterLink} to={crumb.to} underline="hover" color="text.secondary">
            {crumb.label}
          </Link>
        ) : (
          <Typography key={crumb.label} color="text.primary" aria-current={i === trail.length - 1 ? 'page' : undefined} sx={{ fontWeight: 700 }}>
            {crumb.label}
          </Typography>
        ),
      )}
    </Breadcrumbs>
  );
}
