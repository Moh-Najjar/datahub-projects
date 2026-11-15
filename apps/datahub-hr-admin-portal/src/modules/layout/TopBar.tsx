import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import { useTranslation } from 'react-i18next';
import { DemoModeNotice } from '@/modules/shared/DemoModeNotice';
import { LanguageSwitcher } from '@/modules/shared/LanguageSwitcher';
import { ThemeModeSwitcher } from '@/modules/shared/ThemeModeSwitcher';
import { UserMenu } from './UserMenu';

/** App bar: navigation toggle (mobile), demo-mode badge, language, theme and account menu. */
export function TopBar({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  const { t } = useTranslation();
  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Toolbar sx={{ gap: 1 }}>
        {onOpenNavigation && (
          <IconButton edge="start" color="inherit" aria-label={t('shell.openNavigation')} onClick={onOpenNavigation}>
            <MenuOutlined />
          </IconButton>
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
