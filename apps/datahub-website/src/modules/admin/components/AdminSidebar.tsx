import { useState, type ElementType } from 'react';
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
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { ADMIN_ROUTES, ROUTES, WORKSPACE_ROUTES } from '@/core/routes/paths';
import { UI } from '@/i18n';
import { layout } from '@/modules/admin/adminTokens';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { useBlogPermissions } from '@/modules/admin/hooks/useBlogPermissions';
import { accountInitials } from '@/modules/admin/utils/accountInitials';
import { roleLabel, type WorkspaceSession } from '@/modules/portals';

const T = ADMIN_TEXT.shell;
const SIDEBAR_KEY = 'datahub-blogs-admin.sidebar';

interface Entry {
  key: string;
  label: string;
  icon: ElementType;
  to: string;
  /** Opens outside the admin (a new tab). */
  external?: boolean;
  group: 'content' | 'links';
  match?: (pathname: string) => boolean;
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

/** The DataHub monogram (typographic, like the other admin apps) with the app name. */
export function AdminBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <Box aria-hidden="true" dir="ltr" sx={{ width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 1, bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 700, fontSize: 13, letterSpacing: '0.04em' }}>
        DH
      </Box>
      {!compact && (
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.01em' }} noWrap>
            {T.appName}
          </Typography>
          <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }} noWrap>
            {T.appByline}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function NavEntry({ entry, selected, collapsed, onNavigate }: { entry: Entry; selected: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const theme = useTheme();
  const Icon = entry.icon;
  const link = entry.external ? { component: 'a', href: entry.to, target: '_blank', rel: 'noopener' } : { component: RouterLink, to: entry.to };
  const button = (
    <ListItemButton
      {...link}
      onClick={onNavigate}
      selected={selected}
      aria-current={selected ? 'page' : undefined}
      aria-label={entry.label}
      sx={(muiTheme) => ({
        position: 'relative',
        borderRadius: 1,
        mx: collapsed ? 1 : 1.25,
        mb: 0.25,
        minHeight: 40,
        px: collapsed ? 1 : 1.25,
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: selected ? 'primary.main' : 'text.primary',
        bgcolor: selected ? muiTheme.alpha(muiTheme.palette.primary.main, 0.1) : 'transparent',
        '&:hover': { bgcolor: muiTheme.alpha(muiTheme.palette.primary.main, selected ? 0.16 : 0.06) },
        '&.Mui-selected': { bgcolor: muiTheme.alpha(muiTheme.palette.primary.main, 0.1) },
        '&.Mui-selected:hover': { bgcolor: muiTheme.alpha(muiTheme.palette.primary.main, 0.16) },
        // Start-edge marker. `left` is mirrored in RTL by the Emotion cache (not used here: Blogs Admin is English only).
        ...(selected ? { '&::before': { content: '""', position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, bgcolor: 'primary.main' } } : {}),
      })}
    >
      <ListItemIcon sx={{ minWidth: collapsed ? 0 : 34, color: 'inherit', justifyContent: 'center' }}>
        <Icon sx={{ fontSize: 20 }} />
      </ListItemIcon>
      {!collapsed && <ListItemText primary={entry.label} slotProps={{ primary: { sx: { fontWeight: selected ? 600 : 500, fontSize: 14 } } }} />}
      {!collapsed && entry.external && <OpenInNewOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
    </ListItemButton>
  );
  return collapsed ? (
    <Tooltip title={entry.label} placement={theme.direction === 'rtl' ? 'left' : 'right'}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}

function SidebarContent({ session, permanent, collapsed, onToggle, onNavigate }: { session: WorkspaceSession; permanent: boolean; collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const theme = useTheme();
  const { pathname } = useLocation();
  const can = useBlogPermissions();
  const narrow = permanent && collapsed;
  const entries: Entry[] = [
    { key: 'blogs', label: ADMIN_TEXT.nav.blogs, icon: ArticleOutlinedIcon, to: ADMIN_ROUTES.blogs, group: 'content', match: (p) => p.startsWith(ADMIN_ROUTES.blogs) && !p.startsWith(ADMIN_ROUTES.newBlog) },
    ...(can.create ? [{ key: 'new', label: T.newPost, icon: NoteAddOutlinedIcon, to: ADMIN_ROUTES.newBlog, group: 'content' as const }] : []),
    { key: 'workspace', label: ADMIN_TEXT.nav.workspace, icon: AppsOutlinedIcon, to: WORKSPACE_ROUTES.root, group: 'links' },
    { key: 'site', label: ADMIN_TEXT.nav.viewSite, icon: OpenInNewOutlinedIcon, to: ROUTES.blog, external: true, group: 'links' },
  ];
  const groups = [
    { key: 'content', title: T.groupContent, entries: entries.filter((e) => e.group === 'content') },
    { key: 'links', title: T.groupLinks, entries: entries.filter((e) => e.group === 'links') },
  ];
  const flipChevron = (theme.direction === 'rtl') !== collapsed;
  const name = session.name.en;
  const role = roleLabel(session, UI.en.workspace.roles);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ minHeight: layout.header, display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: 'center', justifyContent: narrow ? 'center' : 'space-between', gap: 0.5, px: narrow ? 0.5 : 2, py: narrow ? 1.25 : 0, flexShrink: 0 }}>
        <AdminBrand compact={narrow} />
        {permanent && (
          <Tooltip title={collapsed ? T.expand : T.collapse}>
            <IconButton size="small" aria-label={collapsed ? T.expand : T.collapse} onClick={onToggle} sx={{ color: 'text.secondary' }}>
              <ChevronLeftOutlinedIcon sx={{ transform: flipChevron ? 'scaleX(-1)' : undefined }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Box component="nav" aria-label={T.mainNavigation} sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', pb: 1 }}>
        {groups.map((group, index) => (
          <List
            key={group.key}
            dense
            disablePadding
            subheader={
              narrow ? (
                index === 0 ? undefined : <Divider component="li" sx={{ my: 1, mx: 1.5 }} />
              ) : (
                <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: '32px', mt: index === 0 ? 0.5 : 1.5, px: 2.75, fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>
                  {group.title}
                </ListSubheader>
              )
            }
          >
            {group.entries.map((entry) => (
              <NavEntry key={entry.key} entry={entry} collapsed={narrow} selected={entry.match ? entry.match(pathname) : pathname === entry.to} onNavigate={onNavigate} />
            ))}
          </List>
        ))}
      </Box>
      <Box sx={{ borderTop: 1, borderColor: 'divider', p: narrow ? 1 : 1.5, flexShrink: 0 }}>
        <Tooltip title={narrow ? `${name} — ${role}` : ''}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: narrow ? 'center' : 'flex-start', gap: 1.25, px: narrow ? 0.5 : 1, py: 0.75, minHeight: 48 }}>
            <Avatar aria-hidden="true" sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
              {accountInitials(name)}
            </Avatar>
            {!narrow && (
              <Box sx={{ minWidth: 0 }}>
                <Typography component="span" variant="body2" sx={{ display: 'block', fontWeight: 600 }} noWrap>
                  {name}
                </Typography>
                <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                  {role}
                </Typography>
              </Box>
            )}
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
}

/** Permanent drawer on desktop (collapsible); temporary overlay drawer on phones. */
export function AdminSidebar({ session, permanent, open, onClose }: { session: WorkspaceSession; permanent: boolean; open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const width = permanent && collapsed ? layout.sidebarCollapsed : layout.sidebar;
  const toggle = () =>
    setCollapsed((current) => {
      try {
        window.localStorage.setItem(SIDEBAR_KEY, current ? 'expanded' : 'collapsed');
      } catch {
        // Storage blocked: the state still applies for this visit.
      }
      return !current;
    });
  const paperSx = { width, boxSizing: 'border-box' as const, bgcolor: 'background.paper', overflowX: 'hidden' as const, transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }) };

  if (permanent) {
    return (
      <Drawer variant="permanent" open sx={{ width, flexShrink: 0, transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }), '& .MuiDrawer-paper': paperSx }}>
        <SidebarContent session={session} permanent collapsed={collapsed} onToggle={toggle} />
      </Drawer>
    );
  }
  return (
    <Drawer variant="temporary" open={open} onClose={onClose} sx={{ '& .MuiDrawer-paper': { ...paperSx, width: layout.sidebar } }}>
      <SidebarContent session={session} permanent={false} collapsed={false} onToggle={toggle} onNavigate={onClose} />
    </Drawer>
  );
}
