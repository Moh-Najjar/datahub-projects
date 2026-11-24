import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import AppsOutlined from '@mui/icons-material/AppsOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { workspaceHomeUrl } from '@/core/config/workspace';
import { useAuth } from '@/core/context/authContext';
import { navItem } from '@/core/routes/navigation';
import { layout } from '@/core/theme/tokens';
import { useLanguage } from '@/i18n/useLanguage';
import { DemoModeNotice } from '@/modules/shared/DemoModeNotice';
import { LanguageSwitcher } from '@/modules/shared/LanguageSwitcher';
import { AppBreadcrumbs } from './AppBreadcrumbs';
import { UserMenu } from './UserMenu';

/**
 * Full-width app bar above the sidebar: breadcrumbs on the start side; the Workspace (secondary), the main action for
 * people managers ("New employee", primary), the demo-data badge, language and the account on the end side.
 */
export function TopBar({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  const { t } = useTranslation();
  const { t: te } = useTranslation('employees');
  const { can } = useAuth();
  const { language } = useLanguage();
  const workspace = workspaceHomeUrl(language);
  const newEmployee = `${navItem('employees').path}/new`;
  const createLabel = te('directory.create');

  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Toolbar sx={{ gap: 1, minHeight: { xs: 60, md: layout.header }, px: { xs: 1.5, sm: 3, md: 4 } }}>
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
            <Button component="a" href={workspace} variant="outlined" startIcon={<AppsOutlined />} sx={{ display: { xs: 'none', lg: 'inline-flex' }, color: 'primary.main', minHeight: 38, px: 1.75, borderRadius: 1.25, whiteSpace: 'nowrap' }}>
              {t('actions.backToWorkspace')}
            </Button>
            <Tooltip title={t('actions.backToWorkspace')}>
              <IconButton component="a" href={workspace} color="inherit" aria-label={t('actions.backToWorkspace')} sx={{ display: { xs: 'inline-flex', lg: 'none' } }}>
                <AppsOutlined />
              </IconButton>
            </Tooltip>
          </>
        )}
        {can('organization.employees.manage') && (
          <>
            <Button component={RouterLink} to={newEmployee} variant="contained" startIcon={<AddIcon />} sx={{ display: { xs: 'none', md: 'inline-flex' }, minHeight: 38, px: 2, borderRadius: 1.25, whiteSpace: 'nowrap' }}>
              {createLabel}
            </Button>
            <Tooltip title={createLabel}>
              <IconButton component={RouterLink} to={newEmployee} aria-label={createLabel} sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'primary.main' }}>
                <AddIcon />
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
