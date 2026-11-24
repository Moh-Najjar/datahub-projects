import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import AppsOutlined from '@mui/icons-material/AppsOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import { workspaceHomeUrl } from '@/core/config/workspace';
import { layout } from '@/core/theme/tokens';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { LanguageSwitcher } from '@/modules/shared/LanguageSwitcher';
import { AppBreadcrumbs } from './AppBreadcrumbs';
import { NotificationsMenu } from './NotificationsMenu';
import { UserMenu } from './UserMenu';

/** App bar: page context (breadcrumbs), Workspace, notifications, language and the account menu — as in the HR Admin Portal. */
export function TopBar({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  const t = useT();
  const { locale } = useLocale();
  const workspace = workspaceHomeUrl(locale);
  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', '@media print': { display: 'none' } }}>
      <Toolbar sx={{ gap: 0.5, minHeight: layout.header, px: { xs: 1.5, sm: 2.5 } }}>
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
            <Button component="a" href={workspace} color="inherit" size="small" startIcon={<AppsOutlined />} sx={{ display: { xs: 'none', md: 'inline-flex' }, color: 'text.secondary' }}>
              {t.shell.workspace}
            </Button>
            <Tooltip title={t.shell.workspace}>
              <IconButton component="a" href={workspace} color="inherit" aria-label={t.shell.workspace} sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
                <AppsOutlined />
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
