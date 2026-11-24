import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
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
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { visibleNavGroups, type NavItem } from '@/core/routes/navigation';
import { layout } from '@/core/theme/tokens';

const SIDEBAR_KEY = 'datahub-hr-admin.sidebar';
/** Sidebar surface: a touch lighter than the page canvas, separated by a hairline. */
const SIDEBAR_BG = '#fbfbfd';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function storeCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    // Private browsing can reject storage. The open state still applies for this visit.
  }
}

/** Typographic wordmark "DataHub HR" (a brand name: not translated). Collapsed: "HR" only. */
function Wordmark({ compact }: { compact: boolean }) {
  const { t } = useTranslation();
  return (
    <Typography component="span" aria-label={t('appName')} dir="ltr" sx={{ fontSize: compact ? 16 : 17, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'text.primary' }} noWrap>
      {!compact && 'DataHub '}
      <Box component="span" sx={{ color: 'primary.main' }}>
        HR
      </Box>
    </Typography>
  );
}

function NavEntry({ item, selected, collapsed, onNavigate }: { item: NavItem; selected: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const Icon = item.icon;
  const label = t(`nav.items.${item.key}`);
  const tooltipPlacement = theme.direction === 'rtl' ? 'left' : 'right';
  const current = item.available && selected;

  const button = (
    <ListItemButton
      {...(item.available ? { component: Link, to: item.path, onClick: onNavigate } : { disabled: true, 'aria-disabled': true as const, title: t('shell.comingSoonHint') })}
      selected={current}
      aria-current={current ? 'page' : undefined}
      aria-label={label}
      // Text-only items; the current page is a soft violet pill. Icons appear only in the collapsed rail.
      sx={(muiTheme) => ({
        borderRadius: 1.25,
        mx: collapsed ? 1 : 1.5,
        mb: 0.25,
        minHeight: 40,
        px: collapsed ? 1 : 1.5,
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: current ? 'primary.main' : 'text.secondary',
        bgcolor: current ? 'primary.light' : 'transparent',
        '&:hover': { bgcolor: current ? 'primary.light' : muiTheme.alpha((muiTheme.vars ?? muiTheme).palette.primary.main, 0.05), color: current ? 'primary.main' : 'text.primary' },
        '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'primary.light' },
      })}
    >
      {collapsed && (
        <ListItemIcon sx={{ minWidth: 0, color: 'inherit', justifyContent: 'center' }}>
          <Icon sx={{ fontSize: 20 }} />
        </ListItemIcon>
      )}
      {!collapsed && <ListItemText primary={label} slotProps={{ primary: { sx: { fontWeight: current ? 600 : 500, fontSize: 14 } } }} />}
      {!collapsed && !item.available && <Chip label={t('shell.comingSoon')} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 600 }} />}
    </ListItemButton>
  );

  if (!collapsed) return button;
  // Disabled buttons do not emit pointer events, so the tooltip needs a wrapper.
  return (
    <Tooltip title={label} placement={tooltipPlacement}>
      {item.available ? button : <Box component="span" sx={{ display: 'block' }}>{button}</Box>}
    </Tooltip>
  );
}

/** Navigation for the signed-in role: allowed pages, plus planned areas shown disabled ("Soon"). */
function SidebarContent({ permanent, collapsed, onToggle, onNavigate }: { permanent: boolean; collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { canAny } = useAuth();
  const { pathname } = useLocation();
  const narrow = permanent && collapsed;
  // Point the chevron toward the content edge so "expand" and "collapse" read correctly in both directions.
  const flipChevron = (theme.direction === 'rtl') !== collapsed;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: 'center', justifyContent: narrow ? 'center' : 'space-between', gap: 1, px: narrow ? 1 : 2.5, pt: 3, pb: 1, flexShrink: 0 }}>
        <Wordmark compact={narrow} />
        {permanent && (
          <Tooltip title={collapsed ? t('shell.expandNavigation') : t('shell.collapseNavigation')}>
            <IconButton size="small" aria-label={collapsed ? t('shell.expandNavigation') : t('shell.collapseNavigation')} onClick={onToggle} sx={{ color: 'grey.400' }}>
              <ChevronLeftOutlined sx={{ transform: flipChevron ? 'scaleX(-1)' : undefined }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Box component="nav" aria-label={t('shell.mainNavigation')} sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', pb: 2 }}>
        {visibleNavGroups(canAny).map((group, index) => (
          <List
            key={group.key}
            disablePadding
            subheader={
              narrow ? (
                index === 0 ? undefined : <Divider component="li" sx={{ my: 1.25, mx: 1.5 }} />
              ) : (
                <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: '28px', mt: index === 0 ? 1.5 : 2.5, mb: 0.25, px: 3, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'grey.400' }}>
                  {t(`nav.groups.${group.key}`)}
                </ListSubheader>
              )
            }
          >
            {group.items.map((item) => (
              <NavEntry key={item.key} item={item} collapsed={narrow} onNavigate={onNavigate} selected={pathname === item.path || pathname.startsWith(`${item.path}/`)} />
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
  const toggle = () => {
    setCollapsed((current) => {
      const next = !current;
      storeCollapsed(next);
      return next;
    });
  };

  if (permanent) {
    return (
      <Box
        component="aside"
        sx={{
          width: collapsed ? layout.sidebarCollapsed : layout.sidebar,
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
    <Drawer variant="temporary" open={open} onClose={onClose} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': { width: layout.sidebar, boxSizing: 'border-box', bgcolor: SIDEBAR_BG } }}>
      <SidebarContent permanent={false} collapsed={false} onToggle={toggle} onNavigate={onClose} />
    </Drawer>
  );
}
