import { useState } from 'react';
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

const SIDEBAR_KEY = 'datahub-trainee.sidebar';
const GROUPS: NavGroup[] = ['learn', 'manage'];
/** Sidebar surface: a touch lighter than the page canvas, separated by a hairline. */
const SIDEBAR_BG = '#fbfbfd';

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

/** Typographic wordmark: "DataHub" + the product word in the accent colour. Collapsed: the monogram only. */
function Wordmark({ compact }: { compact: boolean }) {
  const t = useT();
  if (compact) {
    return (
      <Typography aria-label={t.app.name} dir="ltr" sx={{ fontWeight: 800, fontSize: 16, color: 'primary.main' }}>
        DH
      </Typography>
    );
  }
  return (
    <Typography component="span" aria-label={t.app.name} sx={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'text.primary' }} noWrap>
      {t.app.wordmarkLead}{' '}
      <Box component="span" sx={{ color: 'primary.main' }}>
        {t.app.wordmarkAccent}
      </Box>
    </Typography>
  );
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
      // Text-only items; the current page is a soft violet pill. Icons appear only in the collapsed rail.
      sx={(muiTheme) => ({
        borderRadius: 1.25,
        mx: collapsed ? 1 : 1.5,
        mb: 0.25,
        minHeight: 40,
        px: collapsed ? 1 : 1.5,
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: selected ? 'primary.main' : 'text.secondary',
        bgcolor: selected ? 'primary.light' : 'transparent',
        '&:hover': { bgcolor: selected ? 'primary.light' : muiTheme.alpha((muiTheme.vars ?? muiTheme).palette.primary.main, 0.05), color: selected ? 'primary.main' : 'text.primary' },
        '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'primary.light' },
      })}
    >
      {collapsed && (
        <ListItemIcon sx={{ minWidth: 0, color: 'inherit', justifyContent: 'center' }}>
          <Icon sx={{ fontSize: 20 }} />
        </ListItemIcon>
      )}
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
      <Box sx={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: 'center', justifyContent: narrow ? 'center' : 'space-between', gap: 1, px: narrow ? 1 : 2.5, pt: 3, pb: 1, flexShrink: 0 }}>
        <Wordmark compact={narrow} />
        {permanent && (
          <Tooltip title={collapsed ? t.shell.expandSidebar : t.shell.collapseSidebar}>
            <IconButton size="small" aria-label={collapsed ? t.shell.expandSidebar : t.shell.collapseSidebar} onClick={onToggle} sx={{ color: 'grey.400' }}>
              <ChevronLeftOutlined sx={{ transform: flipChevron ? 'scaleX(-1)' : undefined }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Box component="nav" aria-label={t.shell.mainNavigation} sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', pb: 3 }}>
        {groups.map(({ group, items: groupItems }, index) => (
          <List
            key={group}
            disablePadding
            subheader={
              narrow ? (
                index === 0 ? undefined : <Divider component="li" sx={{ my: 1.5, mx: 1.5 }} />
              ) : (
                <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: '28px', mt: index === 0 ? 1.5 : 2.5, mb: 0.25, px: 3, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'grey.400' }}>
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
    </Box>
  );
}

/**
 * Desktop: a sticky column under the top bar (collapsible to an icon rail). Phones: a temporary drawer. Mirrors to the
 * right in RTL (`borderRight` is flipped by the Emotion cache).
 */
export function Sidebar({ permanent, open, onClose }: { permanent: boolean; open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () =>
    setCollapsed((current) => {
      storeCollapsed(!current);
      return !current;
    });

  if (permanent) {
    const width = collapsed ? layout.sidebarCollapsed : layout.sidebar;
    return (
      <Box
        component="aside"
        sx={{
          width,
          flexShrink: 0,
          position: 'sticky',
          top: layout.header,
          height: `calc(100vh - ${layout.header}px)`,
          bgcolor: SIDEBAR_BG,
          borderRight: 1,
          borderColor: 'divider',
          overflow: 'hidden',
          transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
          '@media print': { display: 'none' },
        }}
      >
        <SidebarContent permanent collapsed={collapsed} onToggle={toggle} />
      </Box>
    );
  }
  return (
    <Drawer variant="temporary" open={open} onClose={onClose} ModalProps={{ keepMounted: false }} sx={{ '& .MuiDrawer-paper': { width: layout.sidebar, boxSizing: 'border-box', bgcolor: SIDEBAR_BG } }}>
      <SidebarContent permanent={false} collapsed={false} onToggle={toggle} onNavigate={onClose} />
    </Drawer>
  );
}
