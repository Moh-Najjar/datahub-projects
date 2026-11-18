import { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { workspaceLogoutUrl } from '@/core/config/workspace';
import { useAuth } from '@/core/context/authContext';
import { useLanguage } from '@/i18n/useLanguage';
import { accountInitials } from '@/modules/shared/accountInitials';

/** Avatar menu: who is signed in (name, role, email), profile link, sign out. */
export function UserMenu() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user, can, signOut } = useAuth();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!user) return null;
  const name = user.name[language];

  const go = (path: string) => {
    setAnchor(null);
    navigate(path);
  };

  return (
    <>
      <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={t('shell.userMenu', { name })} aria-haspopup="menu" aria-expanded={!!anchor} sx={{ p: 0.5 }}>
        <Avatar sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}>{accountInitials(name)}</Avatar>
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 1.5, py: 1, minWidth: 220 }}>
          <Typography sx={{ fontWeight: 700 }}>{name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t(`roles.${user.role}`)}
          </Typography>
          <Typography variant="caption" color="text.secondary" dir="ltr" sx={{ display: 'block', mt: 0.25 }}>
            {user.email}
          </Typography>
        </Box>
        <Divider sx={{ my: 0.5 }} />
        {can('profile:view') && (
          <MenuItem onClick={() => go('/profile')}>
            <ListItemIcon>
              <AccountCircleOutlined fontSize="small" />
            </ListItemIcon>
            {t('nav.items.profile')}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setAnchor(null);
            signOut();
            // One central session: Sign out ends it in the DataHub Workspace, which then shows its sign-in page.
            const workspaceLogout = workspaceLogoutUrl(language);
            if (workspaceLogout) window.location.assign(workspaceLogout);
            else navigate('/login', { replace: true });
          }}
        >
          <ListItemIcon>
            <LogoutOutlined fontSize="small" sx={{ transform: (theme) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) }} />
          </ListItemIcon>
          {t('actions.signOut')}
        </MenuItem>
      </Menu>
    </>
  );
}
