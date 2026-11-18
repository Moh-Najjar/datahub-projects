import { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
import { useLanguage } from '@/i18n/useLanguage';
import { accountInitials } from '@/modules/shared/accountInitials';
import { BrandMark } from '@/modules/shared/BrandMark';

export const SIDEBAR_WIDTH = layout.sidebar;

const SIDEBAR_KEY = 'datahub-hr-admin.sidebar';

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

function NavEntry({ item, selected, collapsed }: { item: NavItem; selected: boolean; collapsed: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const Icon = item.icon;
  const label = t(`nav.items.${item.key}`);
  const tooltipPlacement = theme.direction === 'rtl' ? 'left' : 'right';

  const button = (
    <ListItemButton
      {...(item.available ? { component: Link, to: item.path } : { disabled: true, 'aria-disabled': true as const, title: t('shell.comingSoonHint') })}
      selected={item.available && selected}
      aria-current={item.available && selected ? 'page' : undefined}
      aria-label={label}
      sx={(muiTheme) => ({
        position: 'relative',
        borderRadius: 1,
        mx: collapsed ? 1 : 1.25,
        mb: 0.25,
        minHeight: 40,
        px: collapsed ? 1 : 1.25,
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: selected && item.available ? 'primary.main' : 'text.primary',
        bgcolor: selected && item.available ? muiTheme.alpha((muiTheme.vars ?? muiTheme).palette.primary.main, 0.1) : 'transparent',
        '&:hover': {
          bgcolor: muiTheme.alpha((muiTheme.vars ?? muiTheme).palette.primary.main, selected ? 0.16 : 0.06),
        },
        '&.Mui-selected': {
          bgcolor: muiTheme.alpha((muiTheme.vars ?? muiTheme).palette.primary.main, 0.1),
        },
        '&.Mui-selected:hover': {
          bgcolor: muiTheme.alpha((muiTheme.vars ?? muiTheme).palette.primary.main, 0.16),
        },
        // Start-edge marker. `left` is mirrored in RTL by the Emotion cache.
        ...(selected && item.available
          ? {
              '&::before': {
                content: '""',
                position: 'absolute',
                left: 0,
                top: 8,
                bottom: 8,
                width: 3,
                borderRadius: 2,
                bgcolor: 'primary.main',
              },
            }
          : {}),
      })}
    >
      <ListItemIcon sx={{ minWidth: collapsed ? 0 : 34, color: 'inherit', justifyContent: 'center' }}>
        <Icon sx={{ fontSize: 20 }} />
      </ListItemIcon>
      {!collapsed && <ListItemText primary={label} slotProps={{ primary: { sx: { fontWeight: selected ? 600 : 500, fontSize: 14 } } }} />}
      {!collapsed && !item.available && <Chip label={t('shell.comingSoon')} size="small" variant="outlined" sx={{ height: 20, fontSize: 11, fontWeight: 600 }} />}
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

function SidebarAccount({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  if (!user) return null;
  const name = user.name[language];
  const role = t(`roles.${user.role}`);

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', p: collapsed ? 1 : 1.5, flexShrink: 0 }}>
      <Tooltip title={collapsed ? `${name} — ${role}` : ''}>
        <Button
          component={Link}
          to="/profile"
          aria-label={collapsed ? `${name}, ${role}` : undefined}
          color="inherit"
          sx={{
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            textTransform: 'none',
            px: collapsed ? 0.5 : 1,
            py: 0.75,
            gap: 1.25,
            borderRadius: 1,
            minHeight: 48,
          }}
        >
          <Avatar aria-hidden="true" sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}>{accountInitials(name)}</Avatar>
          {!collapsed && (
            <Box sx={{ minWidth: 0, textAlign: 'left' }}>
              <Typography component="span" variant="body2" sx={{ display: 'block', fontWeight: 600 }} noWrap>
                {name}
              </Typography>
              <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                {role}
              </Typography>
            </Box>
          )}
        </Button>
      </Tooltip>
    </Box>
  );
}

/** Navigation for the signed-in role: allowed pages, plus planned areas shown disabled ("Soon"). */
function SidebarContent({ permanent, collapsed, onToggle }: { permanent: boolean; collapsed: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { canAny } = useAuth();
  const { pathname } = useLocation();
  const narrow = permanent && collapsed;
  // Point the chevron toward the content edge so "expand" and "collapse" read correctly in both directions.
  const mirror = theme.direction === 'rtl';
  const flipChevron = mirror !== collapsed;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        sx={{
          minHeight: layout.header,
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: narrow ? 'center' : 'space-between',
          gap: 0.5,
          px: narrow ? 0.5 : 2,
          py: narrow ? 1.25 : 0,
          flexShrink: 0,
        }}
      >
        <BrandMark compact={narrow} />
        {permanent && (
          <Tooltip title={collapsed ? t('shell.expandNavigation') : t('shell.collapseNavigation')}>
            <IconButton
              size="small"
              aria-label={collapsed ? t('shell.expandNavigation') : t('shell.collapseNavigation')}
              onClick={onToggle}
              sx={{ color: 'text.secondary' }}
            >
              <ChevronLeftOutlined sx={{ transform: flipChevron ? 'scaleX(-1)' : undefined }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Box component="nav" aria-label={t('shell.mainNavigation')} sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', pb: 1 }}>
        {visibleNavGroups(canAny).map((group, index) => (
          <List
            key={group.key}
            dense
            disablePadding
            subheader={
              narrow ? (
                index === 0 ? undefined : <Divider component="li" sx={{ my: 1, mx: 1.5 }} />
              ) : (
                <ListSubheader
                  disableSticky
                  sx={{ bgcolor: 'transparent', lineHeight: '32px', mt: index === 0 ? 0.5 : 1.5, px: 2.75, fontSize: 12, fontWeight: 700, color: 'text.secondary' }}
                >
                  {t(`nav.groups.${group.key}`)}
                </ListSubheader>
              )
            }
          >
            {group.items.map((item) => (
              <NavEntry key={item.key} item={item} collapsed={narrow} selected={pathname === item.path || pathname.startsWith(`${item.path}/`)} />
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
  const toggle = () => {
    setCollapsed((current) => {
      const next = !current;
      storeCollapsed(next);
      return next;
    });
  };
  const paperSx = {
    width,
    boxSizing: 'border-box' as const,
    bgcolor: 'background.paper',
    overflowX: 'hidden' as const,
    transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
  };

  if (permanent) {
    return (
      <Drawer
        variant="permanent"
        open
        sx={{
          width,
          flexShrink: 0,
          transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
          '& .MuiDrawer-paper': paperSx,
        }}
      >
        <SidebarContent permanent collapsed={collapsed} onToggle={toggle} />
      </Drawer>
    );
  }
  return (
    <Drawer variant="temporary" open={open} onClose={onClose} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': { ...paperSx, width: layout.sidebar } }}>
      <SidebarContent permanent={false} collapsed={false} onToggle={toggle} />
    </Drawer>
  );
}
