import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { ADMIN_ROUTES, WORKSPACE_ROUTES } from '@/core/routes/paths';
import { UI } from '@/i18n';
import { layout } from '@/modules/admin/adminTokens';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';
import { useBlogPermissions } from '@/modules/admin/hooks/useBlogPermissions';
import { accountInitials } from '@/modules/admin/utils/accountInitials';
import { roleLabel, type WorkspaceSession } from '@/modules/portals';

const T = ADMIN_TEXT.shell;

/** App name › Blog posts › New post / Edit post, or App name › Contact inquiries — derived from the URL. */
function Crumbs() {
  const { pathname } = useLocation();
  const current = (label: string) => (
    <Typography color="text.primary" aria-current="page" noWrap sx={{ fontSize: 'inherit', fontWeight: 700 }}>
      {label}
    </Typography>
  );
  if (pathname.startsWith(ADMIN_ROUTES.inquiries)) {
    return (
      <Breadcrumbs aria-label={T.breadcrumb} separator={<NavigateNextIcon sx={{ fontSize: 16, color: 'grey.400' }} />} sx={{ minWidth: 0, fontSize: 14 }}>
        <Link component={RouterLink} to={WORKSPACE_ROUTES.root} underline="hover" color="text.secondary">
          {T.appName}
        </Link>
        {current(ADMIN_TEXT.nav.inquiries)}
      </Breadcrumbs>
    );
  }
  const onList = pathname === ADMIN_ROUTES.blogs || pathname === ADMIN_ROUTES.blogs.replace(/\/$/, '');
  const tail = pathname.startsWith(ADMIN_ROUTES.newBlog) ? T.newPost : pathname.endsWith('/edit/') || pathname.endsWith('/edit') ? T.editPost : null;
  return (
    <Breadcrumbs aria-label={T.breadcrumb} separator={<NavigateNextIcon sx={{ fontSize: 16, color: 'grey.400' }} />} sx={{ minWidth: 0, fontSize: 14 }}>
      <Link component={RouterLink} to={WORKSPACE_ROUTES.root} underline="hover" color="text.secondary">
        {T.appName}
      </Link>
      {onList ? (
        current(ADMIN_TEXT.nav.blogs)
      ) : (
        <Link component={RouterLink} to={ADMIN_ROUTES.blogs} underline="hover" color="text.secondary">
          {ADMIN_TEXT.nav.blogs}
        </Link>
      )}
      {tail && current(tail)}
    </Breadcrumbs>
  );
}

function AccountMenu({ session }: { session: WorkspaceSession }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const name = session.name.en;
  return (
    <>
      <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={T.userMenu} aria-haspopup="menu" aria-expanded={!!anchor} sx={{ p: 0.5 }}>
        <Avatar sx={{ width: 36, height: 36, fontSize: 13, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}>{accountInitials(name)}</Avatar>
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Box sx={{ px: 1.5, py: 1, minWidth: 240 }}>
          <Typography sx={{ fontWeight: 700 }}>{name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {roleLabel(session, UI.en.workspace.roles)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {session.username}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            navigate(WORKSPACE_ROUTES.logout);
          }}
        >
          <ListItemIcon>
            <LogoutOutlinedIcon fontSize="small" />
          </ListItemIcon>
          {ADMIN_TEXT.nav.signOut}
        </MenuItem>
      </Menu>
    </>
  );
}

/**
 * Full-width app bar above the sidebar (DataHub admin design): breadcrumbs; Portals (secondary), "New post" (primary, for
 * users who may create posts) and the account menu.
 */
export function AdminTopBar({ session, onOpenNavigation }: { session: WorkspaceSession; onOpenNavigation?: () => void }) {
  const can = useBlogPermissions();
  return (
    <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Toolbar sx={{ gap: 1, minHeight: { xs: 60, md: layout.header }, px: { xs: 1.5, sm: 3, md: 4 } }}>
        {onOpenNavigation && (
          <IconButton edge="start" color="inherit" aria-label={T.openMenu} onClick={onOpenNavigation}>
            <MenuOutlinedIcon />
          </IconButton>
        )}
        <Box sx={{ flex: 1, minWidth: 0, display: { xs: 'none', sm: 'flex' }, alignItems: 'center' }}>
          <Crumbs />
        </Box>
        <Box sx={{ flex: { xs: 1, sm: 0 } }} />
        <Button component={RouterLink} to={WORKSPACE_ROUTES.root} variant="outlined" startIcon={<AppsOutlinedIcon />} sx={{ display: { xs: 'none', md: 'inline-flex' }, color: 'primary.main', minHeight: 38, px: 1.75, borderRadius: 1.25, whiteSpace: 'nowrap' }}>
          {ADMIN_TEXT.nav.workspace}
        </Button>
        <Tooltip title={ADMIN_TEXT.nav.workspace}>
          <IconButton component={RouterLink} to={WORKSPACE_ROUTES.root} color="inherit" aria-label={ADMIN_TEXT.nav.workspace} sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
            <AppsOutlinedIcon />
          </IconButton>
        </Tooltip>
        {can.create && (
          <>
            <Button component={RouterLink} to={ADMIN_ROUTES.newBlog} variant="contained" startIcon={<AddIcon />} sx={{ display: { xs: 'none', md: 'inline-flex' }, minHeight: 38, px: 2, borderRadius: 1.25, whiteSpace: 'nowrap' }}>
              {T.newPost}
            </Button>
            <Tooltip title={T.newPost}>
              <IconButton component={RouterLink} to={ADMIN_ROUTES.newBlog} aria-label={T.newPost} sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'primary.main' }}>
                <AddIcon />
              </IconButton>
            </Tooltip>
          </>
        )}
        <AccountMenu session={session} />
      </Toolbar>
    </AppBar>
  );
}
