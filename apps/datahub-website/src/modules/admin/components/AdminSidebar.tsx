import { useState, type ElementType } from 'react';
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
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined';
import MailOutlineIcon from '@mui/icons-material/EmailOutlined';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { ADMIN_ROUTES } from '@/core/routes/paths';
import { layout } from '@/modules/admin/adminTokens';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { useBlogPermissions, useCanViewInquiries } from '@/modules/admin/hooks/useBlogPermissions';

const T = ADMIN_TEXT.shell;
const SIDEBAR_KEY = 'datahub-blogs-admin.sidebar';
/** Sidebar surface: a touch lighter than the page canvas, separated by a hairline. */
const SIDEBAR_BG = '#fbfbfd';

interface Entry {
  key: string;
  label: string;
  icon: ElementType;
  to: string;
  match?: (pathname: string) => boolean;
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

/** Typographic wordmark "DataHub Blogs" (like the other admin apps). Collapsed: "DH". */
function Wordmark({ compact }: { compact: boolean }) {
  return (
    <Typography component="span" aria-label={T.appName} sx={{ fontSize: compact ? 16 : 17, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, color: compact ? 'primary.main' : 'text.primary' }} noWrap>
      {compact ? (
        'DH'
      ) : (
        <>
          DataHub{' '}
          <Box component="span" sx={{ color: 'primary.main' }}>
            Blogs
          </Box>
        </>
      )}
    </Typography>
  );
}

function NavEntry({ entry, selected, collapsed, onNavigate }: { entry: Entry; selected: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = entry.icon;
  const button = (
    <ListItemButton
      component={RouterLink}
      to={entry.to}
      onClick={onNavigate}
      selected={selected}
      aria-current={selected ? 'page' : undefined}
      aria-label={entry.label}
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
        '&:hover': { bgcolor: selected ? 'primary.light' : muiTheme.alpha(muiTheme.palette.primary.main, 0.05), color: selected ? 'primary.main' : 'text.primary' },
        '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'primary.light' },
      })}
    >
      {collapsed && (
        <ListItemIcon sx={{ minWidth: 0, color: 'inherit', justifyContent: 'center' }}>
          <Icon sx={{ fontSize: 20 }} />
        </ListItemIcon>
      )}
      {!collapsed && <ListItemText primary={entry.label} slotProps={{ primary: { sx: { fontWeight: selected ? 600 : 500, fontSize: 14 } } }} />}
    </ListItemButton>
  );
  return collapsed ? (
    <Tooltip title={entry.label} placement="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

function SidebarContent({ permanent, collapsed, onToggle, onNavigate }: { permanent: boolean; collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const can = useBlogPermissions();
  const canViewInquiries = useCanViewInquiries();
  const narrow = permanent && collapsed;
  const entries: Entry[] = [
    { key: 'blogs', label: ADMIN_TEXT.nav.blogs, icon: ArticleOutlinedIcon, to: ADMIN_ROUTES.blogs, match: (p) => p.startsWith(ADMIN_ROUTES.blogs) && !p.startsWith(ADMIN_ROUTES.newBlog) },
    ...(can.create ? [{ key: 'new', label: T.newPost, icon: NoteAddOutlinedIcon, to: ADMIN_ROUTES.newBlog }] : []),
  ];
  const websiteEntries: Entry[] = canViewInquiries ? [{ key: 'inquiries', label: ADMIN_TEXT.nav.inquiries, icon: MailOutlineIcon, to: ADMIN_ROUTES.inquiries, match: (p) => p.startsWith(ADMIN_ROUTES.inquiries) }] : [];
  // Portals is in the top bar.
  const groups = [
    { key: 'content', title: T.groupContent, entries },
    ...(websiteEntries.length ? [{ key: 'website', title: T.groupWebsite, entries: websiteEntries }] : []),
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: 'center', justifyContent: narrow ? 'center' : 'space-between', gap: 1, px: narrow ? 1 : 2.5, pt: 3, pb: 1, flexShrink: 0 }}>
        <Wordmark compact={narrow} />
        {permanent && (
          <Tooltip title={collapsed ? T.expand : T.collapse}>
            <IconButton size="small" aria-label={collapsed ? T.expand : T.collapse} onClick={onToggle} sx={{ color: 'grey.400' }}>
              <ChevronLeftOutlinedIcon sx={{ transform: collapsed ? 'scaleX(-1)' : undefined }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Box component="nav" aria-label={T.mainNavigation} sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', pb: 2 }}>
        {groups.map((group, index) => (
          <List
            key={group.key}
            disablePadding
            subheader={
              narrow ? (
                index === 0 ? undefined : <Divider component="li" sx={{ my: 1.25, mx: 1.5 }} />
              ) : (
                <ListSubheader disableSticky sx={{ bgcolor: 'transparent', lineHeight: '28px', mt: index === 0 ? 1.5 : 2.5, mb: 0.25, px: 3, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'grey.400' }}>
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
    </Box>
  );
}

/** Desktop: a sticky column under the top bar (collapsible to an icon rail). Phones: a temporary drawer. */
export function AdminSidebar({ permanent, open, onClose }: { permanent: boolean; open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () =>
    setCollapsed((current) => {
      try {
        window.localStorage.setItem(SIDEBAR_KEY, current ? 'expanded' : 'collapsed');
      } catch {
        // Storage blocked: the state still applies for this visit.
      }
      return !current;
    });

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
        }}
      >
        <SidebarContent permanent collapsed={collapsed} onToggle={toggle} />
      </Box>
    );
  }
  return (
    <Drawer variant="temporary" open={open} onClose={onClose} sx={{ '& .MuiDrawer-paper': { width: layout.sidebar, boxSizing: 'border-box', bgcolor: SIDEBAR_BG } }}>
      <SidebarContent permanent={false} collapsed={false} onToggle={toggle} onNavigate={onClose} />
    </Drawer>
  );
}
