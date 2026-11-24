import { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/core/auth/authContext';
import { navItemsFor, type NavGroup, type NavItem } from '@/core/routes/navigation';
import { layout } from '@/core/theme/tokens';
import { useT } from '@/i18n/useT';
import { BrandMark } from '@/modules/shared/BrandMark';
import { initialsOf } from '@/modules/shared/utils/initials';

const SIDEBAR_KEY = 'datahub-trainee.sidebar';
const GROUPS: NavGroup[] = ['learn', 'manage'];

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function storeCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    // Private browsing can reject storage. The state still applies for this visit.
  }
}

function NavEntry({ item, selected, collapsed, onNavigate }: { item: NavItem; selected: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const t = useT();
  const theme = useTheme();
  const Icon = item.icon;
  const label = t.nav.items[item.key];

  const button = (
    <ListItemButton
      component={NavLink}
      to={item.path}
      onClick={onNavigate}
      selected={selected}
      aria-current={selected ? 'page' : undefined}
      aria-label={label}
      sx={(muiTheme) => ({
        position: 'relative',
        borderRadius: 1,
        mx: collapsed ? 1 : 1.25,
        mb: 0.25,
        minHeight: 40,
        px: collapsed ? 1 : 1.25,
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: selected ? 'primary.main' : 'text.primary',
        bgcolor: selected ? muiTheme.alpha((muiTheme.vars ?? muiTheme).palette.primary.main, 0.1) : 'transparent',
        '&:hover': { bgcolor: muiTheme.alpha((muiTheme.vars ?? muiTheme).palette.primary.main, selected ? 0.16 : 0.06) },
        '&.Mui-selected': { bgcolor: muiTheme.alpha((muiTheme.vars ?? muiTheme).palette.primary.main, 0.1) },
        '&.Mui-selected:hover': { bgcolor: muiTheme.alpha((muiTheme.vars ?? muiTheme).palette.primary.main, 0.16) },
        // Start-edge marker. `left` is mirrored in RTL by the Emotion cache.
        ...(selected ? { '&::before': { content: '""', position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 1, bgcolor: 'primary.main' } } : {}),
      })}
    >
      <ListItemIcon sx={{ minWidth: collapsed ? 0 : 34, color: 'inherit', justifyContent: 'center' }}>
        <Icon sx={{ fontSize: 20 }} />
      </ListItemIcon>
      {!collapsed && <ListItemText primary={label} slotProps={{ primary: { sx: { fontWeight: selected ? 600 : 500, fontSize: 14 } } }} />}
    </ListItemButton>
  );

  return collapsed ? (
    <Tooltip title={label} placement={theme.direction === 'rtl' ? 'left' : 'right'}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}

function SidebarAccount({ collapsed }: { collapsed: boolean }) {
  const t = useT();
  const { actor } = useAuth();
  if (!actor) return null;
  const role = t.roles[actor.role];
  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', p: collapsed ? 1 : 1.5, flexShrink: 0 }}>
      <Tooltip title={collapsed ? `${actor.fullName} — ${role}` : ''}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 1.25, px: collapsed ? 0.5 : 1, py: 0.75, minHeight: 48 }}>
          <Avatar aria-hidden="true" sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            {initialsOf(actor.fullName)}
          </Avatar>
          {!collapsed && (
            <Box sx={{ minWidth: 0 }}>
              <Typography component="span" variant="body2" sx={{ display: 'block', fontWeight: 600 }} noWrap>
                {actor.fullName}
              </Typography>
              <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                {role}
              </Typography>
            </Box>
          )}
        </Box>
      </Tooltip>
    </Box>
  );
}

/** Role-aware navigation: shows only the pages the user's business role may open. */
function SidebarContent({ permanent, collapsed, onToggle, onNavigate }: { permanent: boolean; collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const t = useT();
  const theme = useTheme();
  const { can } = useAuth();
  const { pathname } = useLocation();
  const narrow = permanent && collapsed;
  const items = navItemsFor(can);
  // Point the chevron toward the content edge so "expand" and "collapse" read correctly in both directions.
  const flipChevron = (theme.direction === 'rtl') !== collapsed;
  const groups = GROUPS.map((group) => ({ group, items: items.filter((item) => item.group === group) })).filter((g) => g.items.length > 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ minHeight: layout.header, display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: 'center', justifyContent: narrow ? 'center' : 'space-between', gap: 0.5, px: narrow ? 0.5 : 2, py: narrow ? 1.25 : 0, flexShrink: 0 }}>
        <BrandMark compact={narrow} />
        {permanent && (
          <Tooltip title={collapsed ? t.shell.expandSidebar : t.shell.collapseSidebar}>
            <IconButton size="small" aria-label={collapsed ? t.shell.expandSidebar : t.shell.collapseSidebar} onClick={onToggle} sx={{ color: 'text.secondary' }}>
              <ChevronLeftOutlined sx={{ transform: flipChevron ? 'scaleX(-1)' : undefined }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Box component="nav" aria-label={t.shell.mainNavigation} sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', pb: 1 }}>
        {groups.map(({ group, items: groupItems }, index) => (
          <List
            key={group}
            dense
            disablePadding
            subheader={
              narrow ? (
                index === 0 ? undefined : <Divider component="li" sx={{ my: 1, mx: 1.5 }} />
              ) : (
                <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: '32px', mt: index === 0 ? 0.5 : 1.5, px: 2.75, fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>
                  {t.nav.groups[group]}
                </ListSubheader>
              )
            }
          >
            {groupItems.map((item) => (
              <NavEntry key={item.key} item={item} collapsed={narrow} selected={pathname === item.path || pathname.startsWith(`${item.path}/`)} onNavigate={onNavigate} />
            ))}
          </List>
        ))}
      </Box>
      <SidebarAccount collapsed={narrow} />
    </Box>
  );
}

/** Permanent drawer on desktop (collapsible); temporary overlay drawer on mobile. Mirrors to the right in RTL. */
export function Sidebar({ permanent, open, onClose }: { permanent: boolean; open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const width = permanent && collapsed ? layout.sidebarCollapsed : layout.sidebar;
  const toggle = () =>
    setCollapsed((current) => {
      storeCollapsed(!current);
      return !current;
    });
  const paperSx = { width, boxSizing: 'border-box' as const, bgcolor: 'background.paper', overflowX: 'hidden' as const, transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }) };

  if (permanent) {
    return (
      <Drawer variant="permanent" open sx={{ width, flexShrink: 0, transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }), '& .MuiDrawer-paper': paperSx, '@media print': { display: 'none' } }}>
        <SidebarContent permanent collapsed={collapsed} onToggle={toggle} />
      </Drawer>
    );
  }
  return (
    <Drawer variant="temporary" open={open} onClose={onClose} ModalProps={{ keepMounted: false }} sx={{ '& .MuiDrawer-paper': { ...paperSx, width: layout.sidebar } }}>
      <SidebarContent permanent={false} collapsed={false} onToggle={toggle} onNavigate={onClose} />
    </Drawer>
  );
}
