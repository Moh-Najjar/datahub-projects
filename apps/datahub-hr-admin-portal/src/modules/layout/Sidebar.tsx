import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Toolbar from '@mui/material/Toolbar';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { visibleNavGroups, type NavItem } from '@/core/routes/navigation';
import { BrandMark } from '@/modules/shared/BrandMark';

export const SIDEBAR_WIDTH = 264;

function NavEntry({ item, selected }: { item: NavItem; selected: boolean }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const label = t(`nav.items.${item.key}`);

  if (!item.available) {
    return (
      <ListItemButton disabled aria-disabled="true" title={t('shell.comingSoonHint')} sx={{ borderRadius: 1, mx: 1 }}>
        <ListItemIcon sx={{ minWidth: 36 }}>
          <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={label} />
        <Chip label={t('shell.comingSoon')} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
      </ListItemButton>
    );
  }

  return (
    <ListItemButton component={Link} to={item.path} selected={selected} aria-current={selected ? 'page' : undefined} sx={{ borderRadius: 1, mx: 1 }}>
      <ListItemIcon sx={{ minWidth: 36, color: selected ? 'primary.main' : undefined }}>
        <Icon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary={label} slotProps={{ primary: { sx: { fontWeight: selected ? 600 : 500 } } }} />
    </ListItemButton>
  );
}

/** Navigation for the signed-in role: allowed pages, plus planned areas shown disabled ("Soon"). */
function SidebarContent() {
  const { t } = useTranslation();
  const { canAny } = useAuth();
  const { pathname } = useLocation();

  return (
    <>
      <Toolbar sx={{ px: 2.5 }}>
        <BrandMark />
      </Toolbar>
      <Box component="nav" aria-label={t('shell.mainNavigation')} sx={{ overflowY: 'auto', pb: 2 }}>
        {visibleNavGroups(canAny).map((group) => (
          <List
            key={group.key}
            dense
            subheader={
              <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: '32px', mt: 1, px: 3, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t(`nav.groups.${group.key}`)}
              </ListSubheader>
            }
          >
            {group.items.map((item) => (
              <NavEntry key={item.key} item={item} selected={pathname === item.path || pathname.startsWith(`${item.path}/`)} />
            ))}
          </List>
        ))}
      </Box>
    </>
  );
}

/** Permanent drawer on desktop; temporary (swipe/overlay) drawer on mobile. Mirrors to the right in RTL. */
export function Sidebar({ permanent, open, onClose }: { permanent: boolean; open: boolean; onClose: () => void }) {
  const paperSx = { width: SIDEBAR_WIDTH, boxSizing: 'border-box' as const, bgcolor: 'background.paper' };

  if (permanent) {
    return (
      <Drawer variant="permanent" open sx={{ width: SIDEBAR_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': paperSx }}>
        <SidebarContent />
      </Drawer>
    );
  }
  return (
    <Drawer variant="temporary" open={open} onClose={onClose} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': paperSx }}>
      <SidebarContent />
    </Drawer>
  );
}
