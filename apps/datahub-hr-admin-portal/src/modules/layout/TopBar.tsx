import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import AppsOutlined from '@mui/icons-material/AppsOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import Tooltip from '@mui/material/Tooltip';
import { useTranslation } from 'react-i18next';
import { workspaceHomeUrl } from '@/core/config/workspace';
import { layout } from '@/core/theme/tokens';
import { useLanguage } from '@/i18n/useLanguage';
import { DemoModeNotice } from '@/modules/shared/DemoModeNotice';
import { LanguageSwitcher } from '@/modules/shared/LanguageSwitcher';
import { AppBreadcrumbs } from './AppBreadcrumbs';
import { UserMenu } from './UserMenu';

/** App bar: page context, Workspace, demo-mode badge, language, theme and account menu. */
export function TopBar({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const workspace = workspaceHomeUrl(language);
  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Toolbar sx={{ gap: 0.5, minHeight: layout.header, px: { xs: 1.5, sm: 2.5 } }}>
        {onOpenNavigation && (
          <IconButton edge="start" color="inherit" aria-label={t('shell.openNavigation')} onClick={onOpenNavigation}>
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
              {t('actions.backToWorkspace')}
            </Button>
            <Tooltip title={t('actions.backToWorkspace')}>
              <IconButton component="a" href={workspace} color="inherit" aria-label={t('actions.backToWorkspace')} sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
                <AppsOutlined />
              </IconButton>
            </Tooltip>
          </>
        )}
        <DemoModeNotice variant="compact" />
        <LanguageSwitcher />
        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}
