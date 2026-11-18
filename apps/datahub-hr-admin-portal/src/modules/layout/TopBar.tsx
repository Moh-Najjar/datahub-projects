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
import { useLanguage } from '@/i18n/useLanguage';
import { DemoModeNotice } from '@/modules/shared/DemoModeNotice';
import { LanguageSwitcher } from '@/modules/shared/LanguageSwitcher';
import { ThemeModeSwitcher } from '@/modules/shared/ThemeModeSwitcher';
import { UserMenu } from './UserMenu';

/** App bar: navigation toggle (mobile), back to the DataHub Workspace, demo-mode badge, language, theme and account menu. */
export function TopBar({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const workspace = workspaceHomeUrl(language);
  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Toolbar sx={{ gap: 1 }}>
        {onOpenNavigation && (
          <IconButton edge="start" color="inherit" aria-label={t('shell.openNavigation')} onClick={onOpenNavigation}>
            <MenuOutlined />
          </IconButton>
        )}
        {workspace && (
          <>
            {/* Same tab: the Workspace lists the other DataHub applications (the session stays). */}
            <Button component="a" href={workspace} color="inherit" startIcon={<AppsOutlined />} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
              {t('actions.backToWorkspace')}
            </Button>
            <Tooltip title={t('actions.backToWorkspace')}>
              <IconButton component="a" href={workspace} color="inherit" aria-label={t('actions.backToWorkspace')} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
                <AppsOutlined />
              </IconButton>
            </Tooltip>
          </>
        )}
        <Box sx={{ flex: 1 }} />
        <DemoModeNotice variant="compact" />
        <LanguageSwitcher />
        <ThemeModeSwitcher />
        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}
