import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/core/auth/authContext';
import { useBreadcrumbContext } from '@/core/hooks/breadcrumbContext';
import { navItemsFor, type NavItem } from '@/core/routes/navigation';
import { ROUTES } from '@/core/routes/paths';
import { useT } from '@/i18n/useT';

/** Home › current section › (record name set by the page). Built from the navigation map; lives in the top bar. */
export function AppBreadcrumbs() {
  const t = useT();
  const { can } = useAuth();
  const { pathname } = useLocation();
  const { tail } = useBreadcrumbContext();

  const section: NavItem | undefined = navItemsFor(can).find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
  if (!section) return null;

  const current = (label: string) => (
    <Typography color="text.primary" aria-current="page" noWrap sx={{ fontSize: 'inherit', fontWeight: 600 }}>
      {label}
    </Typography>
  );

  return (
    <Breadcrumbs aria-label={t.shell.breadcrumb} separator={<NavigateNextIcon fontSize="small" sx={{ transform: (theme) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) }} />} sx={{ minWidth: 0 }}>
      <Link component={RouterLink} to={ROUTES.root} underline="hover" color="text.secondary">
        {t.shell.home}
      </Link>
      {tail ? (
        <Link component={RouterLink} to={section.path} underline="hover" color="text.secondary">
          {t.nav.items[section.key]}
        </Link>
      ) : (
        current(t.nav.items[section.key])
      )}
      {tail && current(tail)}
    </Breadcrumbs>
  );
}
