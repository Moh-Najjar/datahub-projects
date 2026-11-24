import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import AppsOutlined from '@mui/icons-material/AppsOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@/core/auth/authContext';
import { workspaceHomeUrl } from '@/core/config/workspace';
import { ROUTES } from '@/core/routes/paths';
import { layout } from '@/core/theme/tokens';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { LanguageSwitcher } from '@/modules/shared/LanguageSwitcher';
import { AppBreadcrumbs } from './AppBreadcrumbs';
import { NotificationsMenu } from './NotificationsMenu';
import { UserMenu } from './UserMenu';

/**
 * Full-width app bar above the sidebar: page context (breadcrumbs) on the start side; the Workspace (secondary), the
 * main action for managers ("Assign training", primary), notifications, language and the account on the end side.
 */
export function TopBar({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  const t = useT();
  const { can } = useAuth();
  const { locale } = useLocale();
  const workspace = workspaceHomeUrl(locale);
  const assignUrl = `${ROUTES.enrollments}?assign=1`;

  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', '@media print': { display: 'none' } }}>
      <Toolbar sx={{ gap: 1, minHeight: { xs: 60, md: layout.header }, px: { xs: 1.5, sm: 3, md: 4 } }}>
        {onOpenNavigation && (
          <IconButton edge="start" color="inherit" aria-label={t.shell.openMenu} onClick={onOpenNavigation}>
            <MenuOutlined />
          </IconButton>
        )}
        {/* Page context lives in the bar on tablet and desktop; the page title covers phones. */}
        <Box sx={{ flex: 1, minWidth: 0, display: { xs: 'none', sm: 'flex' }, alignItems: 'center' }}>
          <AppBreadcrumbs />
        </Box>
        <Box sx={{ flex: { xs: 1, sm: 0 } }} />
        {workspace && (
          <>
            {/* Same tab: the Workspace lists the other DataHub applications (the session stays). */}
            <Button component="a" href={workspace} variant="outlined" startIcon={<AppsOutlined />} sx={{ display: { xs: 'none', lg: 'inline-flex' }, color: 'primary.main', minHeight: 38, px: 1.75, borderRadius: 1.25, whiteSpace: 'nowrap' }}>
              {t.shell.workspace}
            </Button>
            <Tooltip title={t.shell.workspace}>
              <IconButton component="a" href={workspace} color="inherit" aria-label={t.shell.workspace} sx={{ display: { xs: 'inline-flex', lg: 'none' } }}>
                <AppsOutlined />
              </IconButton>
            </Tooltip>
          </>
        )}
        {can('enrollments.manage') && (
          <>
            <Button component={RouterLink} to={assignUrl} variant="contained" startIcon={<AddIcon />} sx={{ display: { xs: 'none', md: 'inline-flex' }, minHeight: 38, px: 2, borderRadius: 1.25, whiteSpace: 'nowrap' }}>
              {t.enrollments.assign}
            </Button>
            <Tooltip title={t.enrollments.assign}>
              <IconButton component={RouterLink} to={assignUrl} aria-label={t.enrollments.assign} sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'primary.main' }}>
                <AddIcon />
              </IconButton>
            </Tooltip>
          </>
        )}
        <NotificationsMenu />
        <LanguageSwitcher />
        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}
